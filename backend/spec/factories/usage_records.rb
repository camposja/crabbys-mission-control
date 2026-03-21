FactoryBot.define do
  factory :usage_record do
    agent_id      { "crabby" }
    model_id      { "claude-opus-4-6" }
    input_tokens  { 1_000 }
    output_tokens { 500 }
    cost_usd      { 0.015 }
    recorded_at   { Time.current }
    metadata      { {} }
  end
end
