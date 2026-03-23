require "rails_helper"

RSpec.describe Calendar::ExecutionVerifier do
  before { EventStore.clear }

  describe "#call" do
    context "when event has a linked completed task" do
      let(:task) { create(:task, :done, agent_status: "completed") }
      let(:event) { create(:calendar_event, :past, :with_task, task: task) }

      it "returns verified: true with suggested_status completed via task_state" do
        result = described_class.new(event).call

        expect(result[:verified]).to be true
        expect(result[:suggested_status]).to eq("completed")
        expect(result[:verification_source]).to eq("task_state")
        expect(result[:detail]).to include("completed")
        expect(result[:task][:id]).to eq(task.id)
        expect(result[:task][:status]).to eq("done")
        expect(result[:task][:agent_status]).to eq("completed")
      end

      it "updates the event verification columns" do
        described_class.new(event).call
        event.reload

        expect(event.verified_at).to be_present
        expect(event.verification_source).to eq("task_state")
        expect(event.execution_detail).to be_present
      end

      it "updates event status to completed" do
        described_class.new(event).call
        expect(event.reload.status).to eq("completed")
      end
    end

    context "when event has a linked failed task" do
      let(:task) { create(:task, agent_status: "failed") }
      let(:event) { create(:calendar_event, :past, :with_task, task: task) }

      it "returns verified: true with suggested_status failed" do
        result = described_class.new(event).call

        expect(result[:verified]).to be true
        expect(result[:suggested_status]).to eq("failed")
        expect(result[:verification_source]).to eq("task_state")
      end

      it "updates event status to failed" do
        described_class.new(event).call
        expect(event.reload.status).to eq("failed")
      end
    end

    context "when event has a linked task with spawn_failed" do
      let(:task) { create(:task, agent_status: "spawn_failed") }
      let(:event) { create(:calendar_event, :past, :with_task, task: task) }

      it "returns verified: true with suggested_status failed" do
        result = described_class.new(event).call

        expect(result[:verified]).to be true
        expect(result[:suggested_status]).to eq("failed")
        expect(result[:detail]).to include("spawn_failed")
      end
    end

    context "when event has a linked running task" do
      let(:task) { create(:task, :in_progress, agent_status: "running") }
      let(:event) { create(:calendar_event, :with_task, task: task, starts_at: 30.minutes.ago) }

      it "returns verified: true with suggested_status running" do
        result = described_class.new(event).call

        expect(result[:verified]).to be true
        expect(result[:suggested_status]).to eq("running")
        expect(result[:verification_source]).to eq("task_state")
      end
    end

    context "when event has no task, starts_at 2 hours ago, status scheduled" do
      let(:event) { create(:calendar_event, :past, status: "scheduled") }

      it "returns suggested_status missed with unverified source" do
        result = described_class.new(event).call

        expect(result[:verified]).to be false
        expect(result[:suggested_status]).to eq("missed")
        expect(result[:verification_source]).to eq("unverified")
        expect(result[:detail]).to include("no execution evidence")
      end

      it "updates event status to missed" do
        described_class.new(event).call
        expect(event.reload.status).to eq("missed")
      end
    end

    context "when event has no task, starts_at in the future" do
      let(:event) { create(:calendar_event, status: "scheduled", starts_at: 2.hours.from_now) }

      it "returns verified: false with scheduled status" do
        result = described_class.new(event).call

        expect(result[:verified]).to be false
        expect(result[:suggested_status]).to eq("scheduled")
        expect(result[:verification_source]).to eq("unverified")
      end

      it "does not change event status" do
        described_class.new(event).call
        expect(event.reload.status).to eq("scheduled")
      end
    end

    context "when event has a gateway_reference but no task" do
      let(:event) { create(:calendar_event, :past, status: "scheduled", gateway_reference: "gw-123") }

      it "reports gateway verification not yet implemented" do
        result = described_class.new(event).call

        expect(result[:detail]).to include("gateway verification not yet implemented")
      end
    end

    context "when EventStore has relevant events" do
      let(:event) { create(:calendar_event, :past, status: "scheduled", agent_id: "agent-xyz") }

      before do
        EventStore.emit(
          type: "agent_completed",
          message: "Agent finished successfully",
          agent_id: "agent-xyz",
          metadata: { calendar_event_id: event.id }
        )
      end

      it "uses event_store as verification source when no task is present" do
        result = described_class.new(event).call

        expect(result[:verified]).to be true
        expect(result[:suggested_status]).to eq("completed")
        expect(result[:verification_source]).to eq("event_store")
        expect(result[:relevant_events]).not_to be_empty
        expect(result[:relevant_events].first[:type]).to eq("agent_completed")
      end
    end

    context "when event is already in a terminal state" do
      let(:task) { create(:task, :done, agent_status: "completed") }
      let(:event) { create(:calendar_event, :completed, :with_task, task: task, starts_at: 2.hours.ago) }

      it "does not downgrade a completed event" do
        described_class.new(event).call
        expect(event.reload.status).to eq("completed")
      end
    end
  end
end
