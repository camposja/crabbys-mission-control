FactoryBot.define do
  factory :ops_note do
    sequence(:title) { |n| "Ops Note #{n}" }
    sequence(:slug)  { |n| "ops-note-#{n}" }
    body { "Useful internal note" }
    category { "gateway" }
    tags { ["openclaw", "ops"] }
    pinned { false }
    source_links { [{ "label" => "Docs", "url" => "https://docs.openclaw.ai", "source_type" => "official_docs" }] }
    command_snippet { "openclaw gateway restart" }
    notes_format { "markdown" }
    status { "active" }
  end
end
