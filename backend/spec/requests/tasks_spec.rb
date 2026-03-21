require 'rails_helper'

RSpec.describe "Tasks API", type: :request do
  let(:headers) { { "Content-Type" => "application/json" } }

  # ── GET /api/v1/tasks ────────────────────────────────────────────────────────
  describe "GET /api/v1/tasks" do
    it "returns tasks grouped by status" do
      create(:task, :in_progress, title: "Active task")
      create(:task, status: "backlog",  title: "Queued task")

      get "/api/v1/tasks", headers: headers
      expect(response).to have_http_status(:ok)

      body = JSON.parse(response.body)
      expect(body).to have_key("in_progress")
      expect(body).to have_key("backlog")
      expect(body["in_progress"].first["title"]).to eq("Active task")
    end

    it "filters by status when param is given" do
      create(:task, :in_progress)
      create(:task, :done)

      get "/api/v1/tasks?status=in_progress", headers: headers
      body = JSON.parse(response.body)
      expect(body.values.flatten.map { |t| t["status"] }.uniq).to eq(["in_progress"])
    end
  end

  # ── POST /api/v1/tasks ───────────────────────────────────────────────────────
  describe "POST /api/v1/tasks" do
    it "creates a task and returns 201" do
      expect {
        post "/api/v1/tasks",
             params:  { task: { title: "New task", status: "backlog", priority: "high" } }.to_json,
             headers: headers
      }.to change(Task, :count).by(1)

      expect(response).to have_http_status(:created)
      body = JSON.parse(response.body)
      expect(body["title"]).to eq("New task")
      expect(body["status"]).to eq("backlog")
    end

    it "broadcasts task_created via Action Cable" do
      post "/api/v1/tasks",
           params:  { task: { title: "Cable test" } }.to_json,
           headers: headers
      broadcasts = ActionCable.server.pubsub.broadcasts("task_updates")
      payloads   = broadcasts.map { |b| JSON.parse(b) }
      expect(payloads).to include(hash_including("event" => "task_created"))
    end

    it "auto-creates a CalendarEvent when due_date is present" do
      expect {
        post "/api/v1/tasks",
             params:  { task: { title: "Deadline task", due_date: 7.days.from_now.iso8601 } }.to_json,
             headers: headers
      }.to change(CalendarEvent, :count).by(1)

      event = CalendarEvent.last
      expect(event.title).to include("Deadline task")
      expect(event.event_type).to eq("task_deadline")
    end

    it "returns 422 when title is blank" do
      post "/api/v1/tasks",
           params:  { task: { title: "" } }.to_json,
           headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  # ── PATCH /api/v1/tasks/:id/move ─────────────────────────────────────────────
  describe "PATCH /api/v1/tasks/:id/move" do
    let(:task) { create(:task, status: "backlog") }

    it "moves task to a new column" do
      patch "/api/v1/tasks/#{task.id}/move",
            params:  { column: "in_progress" }.to_json,
            headers: headers

      expect(response).to have_http_status(:ok)
      expect(task.reload.status).to eq("in_progress")
    end

    it "accepts 'status' param as alias for 'column'" do
      patch "/api/v1/tasks/#{task.id}/move",
            params:  { status: "review" }.to_json,
            headers: headers

      expect(task.reload.status).to eq("review")
    end

    it "broadcasts task_moved to Action Cable" do
      patch "/api/v1/tasks/#{task.id}/move",
            params:  { column: "done" }.to_json,
            headers: headers
      broadcasts = ActionCable.server.pubsub.broadcasts("task_updates")
      payloads   = broadcasts.map { |b| JSON.parse(b) }
      expect(payloads).to include(hash_including("event" => "task_moved", "new_status" => "done"))
    end

    it "emits task_moved to EventStore" do
      expect(EventStore).to receive(:emit).with(hash_including(type: "task_moved"))
      patch "/api/v1/tasks/#{task.id}/move",
            params:  { column: "in_progress" }.to_json,
            headers: headers
    end

    it "returns 404 for unknown task" do
      patch "/api/v1/tasks/99999/move",
            params:  { column: "done" }.to_json,
            headers: headers
      expect(response).to have_http_status(:not_found)
    end
  end

  # ── DELETE /api/v1/tasks/:id ─────────────────────────────────────────────────
  describe "DELETE /api/v1/tasks/:id" do
    it "deletes the task and returns 204" do
      task = create(:task)
      expect {
        delete "/api/v1/tasks/#{task.id}", headers: headers
      }.to change(Task, :count).by(-1)
      expect(response).to have_http_status(:no_content)
    end
  end
end
