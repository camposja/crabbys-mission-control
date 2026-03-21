require 'rails_helper'

RSpec.describe "Feedbacks API", type: :request do
  let(:headers) { { "Content-Type" => "application/json" } }

  describe "GET /api/v1/feedbacks" do
    it "returns a list of feedbacks" do
      create_list(:feedback, 3)
      get "/api/v1/feedbacks", headers: headers
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body.length).to eq(3)
    end
  end

  describe "POST /api/v1/feedbacks" do
    let(:payload) do
      { feedback: { title: "Add dark mode", description: "Eyes hurt at night", feedback_type: "feature" } }
    end

    it "creates a feedback record" do
      expect {
        post "/api/v1/feedbacks", params: payload.to_json, headers: headers
      }.to change(Feedback, :count).by(1)
      expect(response).to have_http_status(:created)
    end

    it "sets status to pending" do
      post "/api/v1/feedbacks", params: payload.to_json, headers: headers
      expect(Feedback.last.status).to eq("pending")
    end

    it "enqueues FeedbackProcessorJob" do
      expect(FeedbackProcessorJob).to receive(:perform_later).with(Integer)
      post "/api/v1/feedbacks", params: payload.to_json, headers: headers
    end

    it "emits a feedback_submitted event" do
      expect(EventStore).to receive(:emit).with(hash_including(type: "feedback_submitted"))
      post "/api/v1/feedbacks", params: payload.to_json, headers: headers
    end

    it "returns 422 when title is blank" do
      post "/api/v1/feedbacks",
           params:  { feedback: { title: "" } }.to_json,
           headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "PATCH /api/v1/feedbacks/:id/update_status" do
    it "updates the feedback status" do
      fb = create(:feedback)
      patch "/api/v1/feedbacks/#{fb.id}/update_status",
            params:  { status: "done" }.to_json,
            headers: headers
      expect(response).to have_http_status(:ok)
      expect(fb.reload.status).to eq("done")
    end
  end
end
