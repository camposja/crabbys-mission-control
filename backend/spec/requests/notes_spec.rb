require 'rails_helper'

RSpec.describe "Notes API", type: :request do
  let(:headers) { { "Content-Type" => "application/json" } }
  let(:course) { create(:course) }

  describe "GET /api/v1/notes" do
    it "lists notes for a polymorphic owner" do
      create(:note, notable: course, note_type: "course_material")
      create(:note, notable: course, note_type: "personal")
      create(:note, notable: create(:course)) # different owner

      get "/api/v1/notes", params: { notable_type: "Course", notable_id: course.id }, headers: headers
      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body).length).to eq(2)
    end
  end

  describe "POST /api/v1/notes" do
    it "creates a note on a course" do
      payload = { note: { notable_type: "Course", notable_id: course.id, note_type: "personal", body: "Mine" } }
      expect {
        post "/api/v1/notes", params: payload.to_json, headers: headers
      }.to change(Note, :count).by(1)
      expect(response).to have_http_status(:created)
    end

    it "creates a note on a course unit" do
      unit = create(:course_unit, course: course)
      payload = { note: { notable_type: "CourseUnit", notable_id: unit.id, note_type: "course_material", body: "x" } }
      post "/api/v1/notes", params: payload.to_json, headers: headers
      expect(response).to have_http_status(:created)
      expect(unit.notes.count).to eq(1)
    end

    it "returns 422 for a non-whitelisted notable_type" do
      payload = { note: { notable_type: "Project", notable_id: 1, note_type: "personal", body: "x" } }
      post "/api/v1/notes", params: payload.to_json, headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "returns 422 for a blank body" do
      payload = { note: { notable_type: "Course", notable_id: course.id, note_type: "personal", body: "" } }
      post "/api/v1/notes", params: payload.to_json, headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "PATCH /api/v1/notes/:id" do
    it "updates a note" do
      note = create(:note, notable: course, body: "old")
      patch "/api/v1/notes/#{note.id}", params: { note: { body: "new" } }.to_json, headers: headers
      expect(response).to have_http_status(:ok)
      expect(note.reload.body).to eq("new")
    end
  end

  describe "DELETE /api/v1/notes/:id" do
    it "destroys a note" do
      note = create(:note, notable: course)
      expect {
        delete "/api/v1/notes/#{note.id}", headers: headers
      }.to change(Note, :count).by(-1)
      expect(response).to have_http_status(:no_content)
    end
  end
end
