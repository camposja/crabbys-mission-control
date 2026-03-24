require "rails_helper"

RSpec.describe OpsNote, type: :model do
  it "is valid with default factory" do
    expect(build(:ops_note)).to be_valid
  end

  it "generates a slug from title" do
    note = OpsNote.create!(title: "OpenClaw Gateway Restart", category: "gateway", command_snippet: "openclaw gateway restart", notes_format: "markdown", status: "active")
    expect(note.slug).to eq("openclaw-gateway-restart")
  end

  it "normalizes tags" do
    note = OpsNote.create!(title: "Tags", category: "notes", command_snippet: "echo test", tags: [" openclaw ", "openclaw", "ops"], notes_format: "markdown", status: "active")
    expect(note.tags).to eq(["openclaw", "ops"])
  end

  it "allows optional source link fields" do
    note = build(:ops_note, source_links: [{ "label" => "Docs" }])
    expect(note).to be_valid
  end

  it "requires category and command snippet" do
    note = build(:ops_note, category: nil, command_snippet: nil)
    expect(note).not_to be_valid
    expect(note.errors[:category]).to be_present
    expect(note.errors[:command_snippet]).to be_present
  end
end
