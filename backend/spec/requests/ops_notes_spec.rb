require "rails_helper"

RSpec.describe "OpsNotes", type: :request do
  describe "GET /api/v1/ops_notes" do
    let!(:gateway_note) { create(:ops_note, title: "Gateway restart", category: "gateway", tags: ["openclaw", "gateway"], pinned: true) }
    let!(:oauth_note)   { create(:ops_note, title: "OAuth reauth", category: "auth", tags: ["oauth"], body: "Re-auth steps here") }

    it "lists notes" do
      get "/api/v1/ops_notes"
      expect(response).to have_http_status(:ok)
      data = JSON.parse(response.body)
      expect(data["notes"].length).to be >= 2
    end

    it "filters by category" do
      get "/api/v1/ops_notes", params: { category: "gateway" }
      data = JSON.parse(response.body)
      expect(data["notes"].map { |n| n["id"] }).to contain_exactly(gateway_note.id)
    end

    it "filters by tag" do
      get "/api/v1/ops_notes", params: { tag: "oauth" }
      data = JSON.parse(response.body)
      expect(data["notes"].map { |n| n["id"] }).to contain_exactly(oauth_note.id)
    end

    it "filters pinned only" do
      get "/api/v1/ops_notes", params: { pinned: true }
      data = JSON.parse(response.body)
      expect(data["notes"].map { |n| n["id"] }).to contain_exactly(gateway_note.id)
    end

    it "searches title and body" do
      get "/api/v1/ops_notes", params: { q: "reauth" }
      data = JSON.parse(response.body)
      expect(data["notes"].map { |n| n["id"] }).to contain_exactly(oauth_note.id)
    end
  end

  describe "CRUD" do
    let!(:note) { create(:ops_note) }

    it "creates a note" do
      post "/api/v1/ops_notes", params: {
        ops_note: {
          title: "Gateway start",
          body: "Use this when booting the service",
          category: "gateway",
          tags: ["start", "openclaw"],
          pinned: true,
          source_links: [{ label: "Docs", url: "https://docs.openclaw.ai", source_type: "official_docs" }],
          command_snippet: "openclaw gateway start",
          notes_format: "markdown",
          status: "active"
        }
      }

      expect(response).to have_http_status(:created)
      expect(OpsNote.find_by(title: "Gateway start")).to be_present
    end

    it "updates a note" do
      patch "/api/v1/ops_notes/#{note.id}", params: {
        ops_note: { pinned: true, category: "updated" }
      }

      expect(response).to have_http_status(:ok)
      note.reload
      expect(note.pinned).to eq(true)
      expect(note.category).to eq("updated")
    end

    it "deletes a note" do
      delete "/api/v1/ops_notes/#{note.id}"
      expect(response).to have_http_status(:no_content)
      expect(OpsNote.find_by(id: note.id)).to be_nil
    end
  end
end
