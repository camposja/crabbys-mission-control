require 'rails_helper'

RSpec.describe Task, type: :model do
  # ── Validations ─────────────────────────────────────────────────────────────
  it { is_expected.to validate_presence_of(:title) }
  it { is_expected.to validate_inclusion_of(:priority).in_array(Task::PRIORITIES).allow_nil }

  # ── Associations ─────────────────────────────────────────────────────────────
  it { is_expected.to belong_to(:project).optional }

  # ── AASM state machine ───────────────────────────────────────────────────────
  describe "initial state" do
    it "defaults to backlog" do
      task = build(:task)
      expect(task.status).to eq("backlog")
    end
  end

  describe "#start!" do
    it "transitions backlog → in_progress" do
      task = create(:task, status: "backlog")
      expect { task.start! }.to change { task.status }.from("backlog").to("in_progress")
    end

    it "records state_changed_at" do
      task = create(:task, status: "backlog")
      task.start!
      expect(task.state_changed_at).to be_within(2.seconds).of(Time.current)
    end
  end

  describe "#submit_for_review!" do
    it "transitions in_progress → review" do
      task = create(:task, :in_progress)
      expect { task.submit_for_review! }.to change { task.status }.to("review")
    end
  end

  describe "#complete!" do
    it "transitions review → done" do
      task = create(:task, :review)
      expect { task.complete! }.to change { task.status }.to("done")
    end
  end

  # The TasksController#move action uses direct update! for drag-and-drop —
  # bypassing AASM to allow arbitrary direction moves, which is intentional.
  describe "drag-and-drop free move (via update!)" do
    it "allows moving done → backlog" do
      task = create(:task, :done)
      task.update!(status: "backlog")
      expect(task.status).to eq("backlog")
    end

    it "allows moving review → in_progress" do
      task = create(:task, :review)
      task.update!(status: "in_progress")
      expect(task.status).to eq("in_progress")
    end
  end

  # ── Scopes ───────────────────────────────────────────────────────────────────
  describe ".by_status" do
    it "filters by status" do
      in_progress = create(:task, :in_progress)
      _done       = create(:task, :done)
      expect(Task.by_status("in_progress")).to include(in_progress)
      expect(Task.by_status("in_progress")).not_to include(_done)
    end
  end

  describe ".for_crabby" do
    it "returns non-done crabby tasks" do
      crabby_open = create(:task, :for_crabby, status: "in_progress")
      crabby_done = create(:task, :for_crabby, :done)
      jose_task   = create(:task, assignee: "jose")

      result = Task.for_crabby
      expect(result).to include(crabby_open)
      expect(result).not_to include(crabby_done)
      expect(result).not_to include(jose_task)
    end
  end

  # ── Broadcasting ─────────────────────────────────────────────────────────────
  describe "after_update_commit broadcast" do
    it "broadcasts task_updated to task_updates channel" do
      task = create(:task)
      expect(ActionCable.server).to receive(:broadcast).with("task_updates", hash_including(event: "task_updated"))
      task.update!(title: "Updated title")
    end
  end
end
