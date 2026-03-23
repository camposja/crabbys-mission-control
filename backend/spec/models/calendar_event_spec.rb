require 'rails_helper'

RSpec.describe CalendarEvent, type: :model do
  # ── Validations ─────────────────────────────────────────────────────────────
  it { is_expected.to validate_presence_of(:title) }
  it { is_expected.to validate_presence_of(:starts_at) }
  it { is_expected.to validate_inclusion_of(:status).in_array(CalendarEvent::STATUSES) }
  it { is_expected.to validate_inclusion_of(:source).in_array(CalendarEvent::SOURCES) }

  # ── Associations ─────────────────────────────────────────────────────────────
  it { is_expected.to belong_to(:task).optional }
  it { is_expected.to belong_to(:project).optional }
  it { is_expected.to belong_to(:cron_job).optional }

  # ── Status values ───────────────────────────────────────────────────────────
  describe "STATUSES" do
    it "includes all expected values" do
      expect(CalendarEvent::STATUSES).to eq(%w[scheduled running completed failed missed cancelled])
    end
  end

  describe "SOURCES" do
    it "includes all expected values" do
      expect(CalendarEvent::SOURCES).to eq(%w[manual task_run cron_job proactive_job agent_spawn reminder])
    end
  end

  # ── Scopes ─────────────────────────────────────────────────────────────────
  describe ".upcoming" do
    it "returns events with starts_at in the future" do
      future = create(:calendar_event, starts_at: 1.hour.from_now)
      _past  = create(:calendar_event, starts_at: 2.hours.ago)
      expect(CalendarEvent.upcoming).to include(future)
      expect(CalendarEvent.upcoming).not_to include(_past)
    end

    it "orders by starts_at ascending" do
      later  = create(:calendar_event, starts_at: 3.hours.from_now)
      sooner = create(:calendar_event, starts_at: 1.hour.from_now)
      expect(CalendarEvent.upcoming.first).to eq(sooner)
      expect(CalendarEvent.upcoming.last).to eq(later)
    end
  end

  describe ".pending" do
    it "returns scheduled and running events" do
      scheduled = create(:calendar_event, status: "scheduled")
      running   = create(:calendar_event, :running)
      completed = create(:calendar_event, :completed)

      result = CalendarEvent.pending
      expect(result).to include(scheduled, running)
      expect(result).not_to include(completed)
    end
  end

  describe ".for_agent" do
    it "filters by agent_id" do
      agent_event = create(:calendar_event, agent_id: "agent-123")
      _other      = create(:calendar_event, agent_id: "agent-456")
      expect(CalendarEvent.for_agent("agent-123")).to include(agent_event)
      expect(CalendarEvent.for_agent("agent-123")).not_to include(_other)
    end
  end

  describe ".for_task" do
    it "filters by task_id" do
      task  = create(:task)
      event = create(:calendar_event, task: task)
      _other = create(:calendar_event)
      expect(CalendarEvent.for_task(task.id)).to include(event)
      expect(CalendarEvent.for_task(task.id)).not_to include(_other)
    end
  end

  describe ".for_range" do
    it "returns events within the given time range" do
      inside  = create(:calendar_event, starts_at: 2.hours.from_now)
      outside = create(:calendar_event, starts_at: 2.days.from_now)

      result = CalendarEvent.for_range(Time.current, 1.day.from_now)
      expect(result).to include(inside)
      expect(result).not_to include(outside)
    end
  end
end
