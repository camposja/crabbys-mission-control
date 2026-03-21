FactoryBot.define do
  factory :feedback do
    sequence(:title) { |n| "Feedback #{n}" }
    description   { "Description of the issue or request" }
    feedback_type { "feature" }
    status        { "pending" }
    metadata      { {} }

    trait :bug do
      feedback_type { "bug" }
      title         { "Bug: something is broken" }
    end

    trait :done do
      status       { "done" }
      ai_response  { "Here's how to fix it..." }
      branch_name  { "feat/example-feature" }
    end
  end
end
