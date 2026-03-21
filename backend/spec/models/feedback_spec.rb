require 'rails_helper'

RSpec.describe Feedback, type: :model do
  it { is_expected.to validate_presence_of(:title) }
  it { is_expected.to validate_inclusion_of(:feedback_type).in_array(Feedback::TYPES).allow_nil }
  it { is_expected.to validate_inclusion_of(:status).in_array(Feedback::STATUSES).allow_nil }

  describe "defaults" do
    it "sets status to pending on create" do
      feedback = create(:feedback, status: nil)
      expect(feedback.status).to eq("pending")
    end

    it "sets feedback_type to feature on create" do
      feedback = create(:feedback, feedback_type: nil)
      expect(feedback.feedback_type).to eq("feature")
    end
  end

  describe ".pending" do
    it "returns only pending feedbacks" do
      pending_fb = create(:feedback, status: "pending")
      done_fb    = create(:feedback, :done)
      expect(Feedback.pending).to include(pending_fb)
      expect(Feedback.pending).not_to include(done_fb)
    end
  end
end
