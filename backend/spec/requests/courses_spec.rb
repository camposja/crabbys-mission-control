require 'rails_helper'

RSpec.describe "Courses API", type: :request do
  let(:headers) { { "Content-Type" => "application/json" } }

  describe "GET /api/v1/courses" do
    it "lists courses with summary counts" do
      course = create(:course)
      unit = create(:course_unit, course: course)
      create(:note, notable: course)
      create(:link, linkable: unit, project: nil)

      get "/api/v1/courses", headers: headers
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      row = body.find { |c| c["id"] == course.id }
      expect(row["units_count"]).to eq(1)
      expect(row["notes_count"]).to eq(1)
      expect(row["links_count"]).to eq(1)
    end
  end

  describe "POST /api/v1/courses" do
    it "creates a course" do
      payload = { course: { title: "App Dev", diploma: false } }
      expect {
        post "/api/v1/courses", params: payload.to_json, headers: headers
      }.to change(Course, :count).by(1)
      expect(response).to have_http_status(:created)
    end

    it "returns 422 without a title" do
      post "/api/v1/courses", params: { course: { title: "" } }.to_json, headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "GET /api/v1/courses/:id" do
    it "returns course with units, general notes/links, and per-unit notes/links" do
      course = create(:course)
      unit = create(:course_unit, course: course, unit_type: "sequential")
      create(:note, notable: course, note_type: "course_material")
      create(:note, notable: course, note_type: "personal")
      create(:link, linkable: course, project: nil)
      create(:note, notable: unit, note_type: "personal")
      create(:link, linkable: unit, project: nil)

      get "/api/v1/courses/#{course.id}", headers: headers
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)

      expect(body["notes"].length).to eq(2)
      expect(body["notes"].map { |n| n["note_type"] }).to contain_exactly("course_material", "personal")
      expect(body["links"].length).to eq(1)
      expect(body["units"].length).to eq(1)
      expect(body["units"].first["unit_type"]).to eq("sequential")
      expect(body["units"].first["notes"].length).to eq(1)
      expect(body["units"].first["links"].length).to eq(1)
    end
  end

  describe "PATCH /api/v1/courses/:id" do
    it "updates course details" do
      course = create(:course, title: "Old")
      patch "/api/v1/courses/#{course.id}", params: { course: { title: "New" } }.to_json, headers: headers
      expect(response).to have_http_status(:ok)
      expect(course.reload.title).to eq("New")
    end
  end

  describe "DELETE /api/v1/courses/:id" do
    it "destroys the course and cascades" do
      course = create(:course)
      create(:course_unit, course: course)
      expect {
        delete "/api/v1/courses/#{course.id}", headers: headers
      }.to change(Course, :count).by(-1).and change(CourseUnit, :count).by(-1)
      expect(response).to have_http_status(:no_content)
    end
  end

  describe "Nested units — POST /api/v1/courses/:course_id/units" do
    it "creates topic and sequential units" do
      course = create(:course)
      post "/api/v1/courses/#{course.id}/units",
           params: { course_unit: { title: "Development", unit_type: "topic" } }.to_json, headers: headers
      expect(response).to have_http_status(:created)
      post "/api/v1/courses/#{course.id}/units",
           params: { course_unit: { title: "Module 1", unit_type: "sequential" } }.to_json, headers: headers
      expect(response).to have_http_status(:created)
      expect(course.course_units.pluck(:unit_type)).to contain_exactly("topic", "sequential")
    end
  end

  describe "PATCH /api/v1/courses/:course_id/units/reorder" do
    it "rewrites unit positions atomically from ordered_ids" do
      course = create(:course)
      a = create(:course_unit, course: course, position: 1)
      b = create(:course_unit, course: course, position: 2)
      c = create(:course_unit, course: course, position: 3)

      patch "/api/v1/courses/#{course.id}/units/reorder",
            params: { ordered_ids: [c.id, a.id, b.id] }.to_json, headers: headers
      expect(response).to have_http_status(:ok)
      expect(c.reload.position).to eq(1)
      expect(a.reload.position).to eq(2)
      expect(b.reload.position).to eq(3)
    end

    it "returns 422 when ordered_ids do not match the course's units" do
      course = create(:course)
      create(:course_unit, course: course)
      foreign = create(:course_unit) # different course
      patch "/api/v1/courses/#{course.id}/units/reorder",
            params: { ordered_ids: [foreign.id] }.to_json, headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "POST /api/v1/courses/bulk_upsert" do
    let(:payload) do
      {
        courses: [
          {
            external_id: "app-development-course",
            title: "App Development Course",
            description: "Course material.",
            units: [
              {
                external_id: "development",
                title: "Development",
                unit_type: "topic",
                position: 1,
                notes: [
                  { external_id: "dev-note-1", note_type: "course_material", title: "Overview", body: "Material." },
                  { external_id: "dev-personal-1", note_type: "personal", title: "Mine", body: "My notes." }
                ],
                links: [
                  { external_id: "dev-link-1", url: "https://example.com", title: "Resource", source_type: "website" }
                ]
              }
            ]
          }
        ]
      }
    end

    it "creates new records" do
      expect {
        post "/api/v1/courses/bulk_upsert", params: payload.to_json, headers: headers
      }.to change(Course, :count).by(1)
        .and change(CourseUnit, :count).by(1)
        .and change(Note, :count).by(2)
        .and change(Link, :count).by(1)

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["created"]["course"]).to eq(1)
      expect(body["created"]["note"]).to eq(2)
    end

    it "updates existing records by external_id without duplicating" do
      post "/api/v1/courses/bulk_upsert", params: payload.to_json, headers: headers
      updated = payload.deep_dup
      updated[:courses][0][:title] = "Renamed Course"
      updated[:courses][0][:units][0][:notes][0][:body] = "Edited material."

      expect {
        post "/api/v1/courses/bulk_upsert", params: updated.to_json, headers: headers
      }.to change(Course, :count).by(0).and change(Note, :count).by(0)

      expect(Course.find_by(external_id: "app-development-course").title).to eq("Renamed Course")
      note = Note.find_by(external_id: "dev-note-1")
      expect(note.body).to eq("Edited material.")
    end

    it "reuses external_id keys across different parents" do
      twin = {
        courses: [
          { external_id: "c1", title: "C1", units: [
            { external_id: "intro", title: "Intro A", notes: [{ external_id: "n", note_type: "personal", body: "A" }] }
          ] },
          { external_id: "c2", title: "C2", units: [
            { external_id: "intro", title: "Intro B", notes: [{ external_id: "n", note_type: "personal", body: "B" }] }
          ] }
        ]
      }
      post "/api/v1/courses/bulk_upsert", params: twin.to_json, headers: headers
      expect(response).to have_http_status(:ok)
      expect(CourseUnit.where(external_id: "intro").count).to eq(2)
      expect(Note.where(external_id: "n").count).to eq(2)
    end

    it "deletes ONLY on an explicit delete operation" do
      post "/api/v1/courses/bulk_upsert", params: payload.to_json, headers: headers

      # Re-sending without the note must NOT delete it.
      trimmed = payload.deep_dup
      trimmed[:courses][0][:units][0][:notes] = []
      expect {
        post "/api/v1/courses/bulk_upsert", params: trimmed.to_json, headers: headers
      }.to change(Note, :count).by(0)

      # Explicit delete removes it.
      del = {
        deletes: [
          { entity: "note", external_id: "dev-note-1",
            course_external_id: "app-development-course", unit_external_id: "development" }
        ]
      }
      expect {
        post "/api/v1/courses/bulk_upsert", params: del.to_json, headers: headers
      }.to change(Note, :count).by(-1)
      body = JSON.parse(response.body)
      expect(body["deleted"]["note"]).to eq(1)
    end

    it "persists link metadata (no unknown-attribute error)" do
      meta_payload = {
        courses: [
          { external_id: "meta-course", title: "Meta", links: [
            { external_id: "ml-1", url: "https://example.com", metadata: { "kind" => "video", "duration" => 120 } }
          ] }
        ]
      }
      post "/api/v1/courses/bulk_upsert", params: meta_payload.to_json, headers: headers
      expect(response).to have_http_status(:ok)
      link = Link.find_by(external_id: "ml-1")
      expect(link.metadata).to eq("kind" => "video", "duration" => 120)
    end

    it "updates the exact course by id (and backfills external_id) without duplicating" do
      course = create(:course, title: "Original", external_id: nil)
      by_id = { courses: [{ id: course.id, external_id: "now-keyed", title: "Renamed by id" }] }
      expect {
        post "/api/v1/courses/bulk_upsert", params: by_id.to_json, headers: headers
      }.to change(Course, :count).by(0)
      course.reload
      expect(course.title).to eq("Renamed by id")
      expect(course.external_id).to eq("now-keyed")
    end

    it "returns 422 for an invalid payload and rolls back the whole batch" do
      bad = {
        courses: [
          { external_id: "ok-course", title: "OK" },
          { external_id: "x", title: "X", units: [
            { external_id: "u", title: "U", notes: [{ external_id: "n", note_type: "BOGUS", body: "" }] }
          ] }
        ]
      }
      expect {
        post "/api/v1/courses/bulk_upsert", params: bad.to_json, headers: headers
      }.to change(Course, :count).by(0) # course #1 rolled back too — no partial write
      expect(response).to have_http_status(:unprocessable_entity)

      body = JSON.parse(response.body)
      expect(body["error"]).to eq("Bulk upsert failed")
      detail = body["details"].first
      expect(detail["entity"]).to eq("note")
      expect(detail["path"]).to eq("courses[1].units[0].notes[0]")
      expect(detail["message"]).to be_present
    end

    it "always returns the full summary shape including skipped" do
      post "/api/v1/courses/bulk_upsert",
           params: { courses: [{ external_id: "shape", title: "Shape" }] }.to_json, headers: headers
      body = JSON.parse(response.body)
      expect(body.keys).to include("created", "updated", "deleted", "skipped", "errors")
    end

    it "returns 422 for an empty payload (no courses, no deletes)" do
      post "/api/v1/courses/bulk_upsert", params: {}.to_json, headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "returns 422 for an array body" do
      post "/api/v1/courses/bulk_upsert", params: [{ title: "X" }].to_json, headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
    end

    describe "delete semantics" do
      let(:seed) do
        { courses: [{ external_id: "c", title: "C", units: [
          { external_id: "u", title: "U", notes: [{ external_id: "n", note_type: "personal", body: "x" }] }
        ] }] }
      end

      it "returns 422 when a well-formed delete target is missing" do
        del = { deletes: [{ entity: "note", external_id: "ghost", course_external_id: "c", unit_external_id: "u" }] }
        post "/api/v1/courses/bulk_upsert", params: del.to_json, headers: headers
        expect(response).to have_http_status(:unprocessable_entity)
      end

      it "skips a missing target (200) when ignore_missing_deletes is true" do
        del = {
          ignore_missing_deletes: true,
          deletes: [{ entity: "note", external_id: "ghost", course_external_id: "c", unit_external_id: "u" }]
        }
        post "/api/v1/courses/bulk_upsert", params: del.to_json, headers: headers
        expect(response).to have_http_status(:ok)
        expect(JSON.parse(response.body)["skipped"]["note"]).to eq(1)
      end

      it "returns 422 for an unknown delete entity (malformed)" do
        del = { deletes: [{ entity: "widget", external_id: "x" }] }
        post "/api/v1/courses/bulk_upsert", params: del.to_json, headers: headers
        expect(response).to have_http_status(:unprocessable_entity)
      end

      it "returns 422 for a malformed delete missing course_external_id" do
        del = { deletes: [{ entity: "note", external_id: "n" }] }
        post "/api/v1/courses/bulk_upsert", params: del.to_json, headers: headers
        expect(response).to have_http_status(:unprocessable_entity)
      end
    end

    it "returns 422 for a wrong-parent unit id and writes nothing" do
      c1 = create(:course)
      other = create(:course)
      foreign_unit = create(:course_unit, course: other)
      payload = { courses: [{ id: c1.id, title: "C1", units: [{ id: foreign_unit.id, title: "Hijack" }] }] }
      expect {
        post "/api/v1/courses/bulk_upsert", params: payload.to_json, headers: headers
      }.to change(CourseUnit, :count).by(0)
      expect(response).to have_http_status(:unprocessable_entity)
      expect(foreign_unit.reload.title).not_to eq("Hijack")
    end

    it "returns 422 when id and external_id conflict with a different record" do
      course = create(:course)
      a = create(:course_unit, course: course, external_id: "keep")
      b = create(:course_unit, course: course, external_id: "other")
      # Try to set b's external_id to one already owned by a.
      payload = { courses: [{ id: course.id, title: course.title,
                              units: [{ id: b.id, external_id: "keep", title: "Conflict" }] }] }
      post "/api/v1/courses/bulk_upsert", params: payload.to_json, headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
      expect(b.reload.external_id).to eq("other")
    end
  end
end
