require "rails_helper"

RSpec.describe OpsNote, type: :model do
  it "is valid with default factory" do
    expect(build(:ops_note)).to be_valid
  end

  it "generates a slug from title" do
    note = OpsNote.create!(title: "OpenClaw Gateway Restart", notes_format: "markdown", status: "active")
    expect(note.slug).to eq("openclaw-gateway-restart")
  end

  it "normalizes tags" do
    note = OpsNote.create!(title: "Tags", tags: [" openclaw ", "openclaw", "ops"], notes_format: "markdown", status: "active")
    expect(note.tags).to eq(["openclaw", "ops"])
  end

  it "requires well-formed source links" do
    note = build(:ops_note, source_links: [{ "label" => "Docs" }])
    expect(note).not_to be_valid
    expect(note.errors[:source_links]).to be_present
  end
end
