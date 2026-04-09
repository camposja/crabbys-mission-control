FactoryBot.define do
  factory :link do
    sequence(:url) { |n| "https://example.com/page-#{n}" }
    association :project
    source_type { "other" }

    trait :youtube do
      url { "https://youtube.com/watch?v=abc123" }
    end

    trait :github do
      url { "https://github.com/owner/repo" }
    end

    trait :twitter do
      url { "https://twitter.com/user/status/123" }
    end

    trait :with_task do
      task { association :task, project: project }
    end

    trait :with_notes do
      notes { "Some context about this link" }
    end
  end
end
