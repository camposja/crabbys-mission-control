require 'rails_helper'

RSpec.describe "Calendar API", type: :request do
  let(:headers) { { "Content-Type" => "application/json" } }

  # ── GET /api/v1/calendar ───────────────────────────────────────────────────
  describe "GET /api/v1/calendar" do
    before do
      create(:calendar_event, title: "Upcoming deploy", starts_at: 2.hours.from_now)
      create(:cron_job, name: "Nightly backup", enabled: true)
      create(:cron_job, name: "Disabled job", enabled: false)
    end

    it "returns upcoming_events, active_cron_jobs, and summary keys" do
      get "/api/v1/calendar", headers: headers
      expect(response).to have_http_status(:ok)

      body = JSON.parse(response.body)
      expect(body).to have_key("upcoming_events")
      expect(body).to have_key("active_cron_jobs")
      expect(body).to have_key("summary")

      expect(body["upcoming_events"].length).to eq(1)
      expect(body["upcoming_events"].first["title"]).to eq("Upcoming deploy")

      # Only enabled cron jobs appear
      expect(body["active_cron_jobs"].length).to eq(1)
      expect(body["active_cron_jobs"].first["name"]).to eq("Nightly backup")

      # Summary includes expected keys
      summary = body["summary"]
      expect(summary).to have_key("total_scheduled")
      expect(summary).to have_key("upcoming_24h")
      expect(summary).to have_key("active_cron_jobs")
      expect(summary).to have_key("checked_at")
    end
  end

  # ── GET /api/v1/calendar/events ────────────────────────────────────────────
  describe "GET /api/v1/calendar/events" do
    let!(:event_in_range)  { create(:calendar_event, title: "In range",  starts_at: 3.days.from_now) }
    let!(:event_out_range) { create(:calendar_event, title: "Out range", starts_at: 60.days.from_now) }
    let!(:failed_event)    { create(:calendar_event, :failed, title: "Failed job", starts_at: 2.days.from_now) }

    it "returns events within the default date range" do
      get "/api/v1/calendar/events", headers: headers
      body = JSON.parse(response.body)

      titles = body.map { |e| e["title"] }
      expect(titles).to include("In range")
      expect(titles).not_to include("Out range")
    end

    it "returns events within a custom date range" do
      get "/api/v1/calendar/events",
          params: { start_date: 50.days.from_now.iso8601, end_date: 70.days.from_now.iso8601 },
          headers: headers
      body = JSON.parse(response.body)

      titles = body.map { |e| e["title"] }
      expect(titles).to include("Out range")
      expect(titles).not_to include("In range")
    end

    it "filters by status" do
      get "/api/v1/calendar/events", params: { status: "failed" }, headers: headers
      body = JSON.parse(response.body)

      expect(body.length).to eq(1)
      expect(body.first["title"]).to eq("Failed job")
      expect(body.first["status"]).to eq("failed")
    end

    it "rejects invalid status" do
      get "/api/v1/calendar/events", params: { status: "bogus" }, headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "filters by agent_id" do
      create(:calendar_event, :agent_spawn, agent_id: "agent-abc", starts_at: 1.day.from_now)

      get "/api/v1/calendar/events", params: { agent_id: "agent-abc" }, headers: headers
      body = JSON.parse(response.body)

      expect(body.length).to eq(1)
      expect(body.first["agent_id"]).to eq("agent-abc")
    end

    it "filters by task_id" do
      task = create(:task)
      create(:calendar_event, :with_task, task: task, starts_at: 1.day.from_now)

      get "/api/v1/calendar/events", params: { task_id: task.id }, headers: headers
      body = JSON.parse(response.body)

      expect(body.length).to eq(1)
      expect(body.first["task_id"]).to eq(task.id)
      expect(body.first["task"]).to be_a(Hash)
      expect(body.first["task"]["id"]).to eq(task.id)
    end

    it "includes serialized task and project when present" do
      project = create(:project, name: "Starship")
      task    = create(:task, title: "Launch prep", project: project)
      create(:calendar_event, title: "With associations", starts_at: 1.day.from_now, task: task, project: project)

      get "/api/v1/calendar/events", headers: headers
      body = JSON.parse(response.body)

      assoc_event = body.find { |e| e["title"] == "With associations" }
      expect(assoc_event["task"]["title"]).to eq("Launch prep")
      expect(assoc_event["project"]["title"]).to eq("Starship")
    end
  end

  # ── GET /api/v1/calendar/cron_jobs ─────────────────────────────────────────
  describe "GET /api/v1/calendar/cron_jobs" do
    before do
      create(:cron_job, name: "Alpha job", cron_expression: "0 * * * *")
      create(:cron_job, :failed, name: "Beta job")
      create(:cron_job, :with_task, name: "Gamma job")
    end

    it "returns all cron jobs with expected keys" do
      get "/api/v1/calendar/cron_jobs", headers: headers
      expect(response).to have_http_status(:ok)

      body = JSON.parse(response.body)
      expect(body.length).to eq(3)

      first = body.first # ordered by name: Alpha
      expect(first).to have_key("id")
      expect(first).to have_key("name")
      expect(first).to have_key("cron_expression")
      expect(first).to have_key("enabled")
      expect(first).to have_key("status")
      expect(first).to have_key("last_run_at")
      expect(first).to have_key("next_run_at")
      expect(first).to have_key("failure_count")
      expect(first).to have_key("last_error")
      expect(first).to have_key("agent_id")
      expect(first).to have_key("task_id")
      expect(first).to have_key("project_id")
      expect(first).to have_key("gateway_reference")
      expect(first).to have_key("task")
      expect(first).to have_key("project")
    end

    it "includes nested task when associated" do
      get "/api/v1/calendar/cron_jobs", headers: headers
      body = JSON.parse(response.body)

      gamma = body.find { |cj| cj["name"] == "Gamma job" }
      expect(gamma["task"]).to be_a(Hash)
      expect(gamma["task"]).to have_key("id")
      expect(gamma["task"]).to have_key("title")
    end
  end

  # ── GET /api/v1/calendar/events/:id/history ────────────────────────────────
  describe "GET /api/v1/calendar/events/:id/history" do
    before { EventStore.clear }

    it "returns the correct response shape" do
      event = create(:calendar_event, title: "Verify me", starts_at: 2.hours.from_now, status: "scheduled")

      get "/api/v1/calendar/events/#{event.id}/history", headers: headers
      expect(response).to have_http_status(:ok)

      body = JSON.parse(response.body)
      expect(body).to have_key("event")
      expect(body).to have_key("verification")
      expect(body).to have_key("task")
      expect(body).to have_key("relevant_events")

      expect(body["event"]["id"]).to eq(event.id)
      expect(body["event"]).to have_key("run_attempts")
      expect(body["event"]).to have_key("verified_at")
      expect(body["event"]).to have_key("verification_source")
      expect(body["event"]).to have_key("execution_detail")

      expect(body["verification"]).to have_key("verified")
      expect(body["verification"]).to have_key("suggested_status")
      expect(body["verification"]).to have_key("verification_source")
      expect(body["verification"]).to have_key("detail")
      expect(body["verification"]).to have_key("checked_at")
    end

    it "returns task data when event has a linked task" do
      task = create(:task, :done, title: "Deploy v2", agent_status: "completed")
      event = create(:calendar_event, :with_task, task: task, starts_at: 2.hours.ago, status: "scheduled")

      get "/api/v1/calendar/events/#{event.id}/history", headers: headers
      body = JSON.parse(response.body)

      expect(body["task"]).to be_a(Hash)
      expect(body["task"]["id"]).to eq(task.id)
      expect(body["task"]["title"]).to eq("Deploy v2")
      expect(body["task"]["status"]).to eq("done")
      expect(body["task"]["agent_status"]).to eq("completed")
    end

    it "returns verification result reflecting task state" do
      task = create(:task, :done, agent_status: "completed")
      event = create(:calendar_event, :with_task, task: task, starts_at: 2.hours.ago, status: "scheduled")

      get "/api/v1/calendar/events/#{event.id}/history", headers: headers
      body = JSON.parse(response.body)

      expect(body["verification"]["verified"]).to be true
      expect(body["verification"]["suggested_status"]).to eq("completed")
      expect(body["verification"]["verification_source"]).to eq("task_state")
    end

    it "returns 404 for non-existent event" do
      get "/api/v1/calendar/events/999999/history", headers: headers
      expect(response).to have_http_status(:not_found)
    end
  end

  # ── GET /api/v1/calendar/summary ───────────────────────────────────────────
  describe "GET /api/v1/calendar/summary" do
    before do
      create(:calendar_event, status: "scheduled", starts_at: 2.hours.from_now)
      create(:calendar_event, status: "scheduled", starts_at: 12.hours.from_now)
      create(:calendar_event, status: "scheduled", starts_at: 3.days.from_now)
      create(:calendar_event, :running, starts_at: 1.hour.ago)
      create(:calendar_event, :failed, starts_at: 2.hours.ago)
      create(:calendar_event, :failed, starts_at: 3.hours.ago)
      create(:calendar_event, :completed, starts_at: 5.hours.ago, updated_at: Time.current)
      create(:cron_job, enabled: true)
      create(:cron_job, :disabled)
    end

    it "returns correct counts" do
      get "/api/v1/calendar/summary", headers: headers
      expect(response).to have_http_status(:ok)

      body = JSON.parse(response.body)
      expect(body["total_scheduled"]).to eq(3)
      expect(body["upcoming_24h"]).to eq(2)
      expect(body["running"]).to eq(1)
      expect(body["failed"]).to eq(2)
      expect(body["missed"]).to eq(0)
      expect(body["cancelled"]).to eq(0)
      expect(body["completed_today"]).to eq(1)
      expect(body["active_cron_jobs"]).to eq(1)
      expect(body["checked_at"]).to be_present
    end
  end
end
