require 'rails_helper'

RSpec.describe "Links API", type: :request do
  let(:headers) { { "Content-Type" => "application/json" } }
  let(:project) { create(:project) }

  describe "GET /api/v1/links" do
    it "returns all links" do
      create_list(:link, 3, project: project)
      get "/api/v1/links", headers: headers
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body.length).to eq(3)
    end

    it "filters by project_id" do
      create(:link, project: project)
      create(:link) # different project
      get "/api/v1/links", params: { project_id: project.id }, headers: headers
      body = JSON.parse(response.body)
      expect(body.length).to eq(1)
      expect(body.first["project_id"]).to eq(project.id)
    end

    it "filters by task_id" do
      task = create(:task, project: project)
      create(:link, project: project, task: task)
      create(:link, project: project) # no task
      get "/api/v1/links", params: { task_id: task.id }, headers: headers
      body = JSON.parse(response.body)
      expect(body.length).to eq(1)
      expect(body.first["task_id"]).to eq(task.id)
    end

    it "returns links in recent-first order" do
      old = create(:link, project: project, created_at: 2.days.ago)
      new_link = create(:link, project: project, created_at: 1.hour.ago)
      get "/api/v1/links", headers: headers
      body = JSON.parse(response.body)
      expect(body.first["id"]).to eq(new_link.id)
      expect(body.last["id"]).to eq(old.id)
    end
  end

  describe "POST /api/v1/links" do
    it "creates a link" do
      payload = { link: { project_id: project.id, url: "https://example.com" } }
      expect {
        post "/api/v1/links", params: payload.to_json, headers: headers
      }.to change(Link, :count).by(1)
      expect(response).to have_http_status(:created)
    end

    it "auto-infers source_type from URL" do
      payload = { link: { project_id: project.id, url: "https://youtube.com/watch?v=abc" } }
      post "/api/v1/links", params: payload.to_json, headers: headers
      body = JSON.parse(response.body)
      expect(body["source_type"]).to eq("youtube")
    end

    it "returns 422 when URL is blank" do
      payload = { link: { project_id: project.id, url: "" } }
      post "/api/v1/links", params: payload.to_json, headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "returns 422 when project_id is missing" do
      payload = { link: { url: "https://example.com" } }
      post "/api/v1/links", params: payload.to_json, headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "returns 422 when task belongs to a different project" do
      other_project = create(:project)
      task = create(:task, project: other_project)
      payload = { link: { project_id: project.id, task_id: task.id, url: "https://example.com" } }
      post "/api/v1/links", params: payload.to_json, headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "DELETE /api/v1/links/:id" do
    it "destroys the link" do
      link = create(:link, project: project)
      expect {
        delete "/api/v1/links/#{link.id}", headers: headers
      }.to change(Link, :count).by(-1)
      expect(response).to have_http_status(:no_content)
    end

    it "returns 404 for nonexistent link" do
      delete "/api/v1/links/999999", headers: headers
      expect(response).to have_http_status(:not_found)
    end
  end
end
