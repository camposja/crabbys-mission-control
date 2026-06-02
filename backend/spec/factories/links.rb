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

    # Course/unit links use the polymorphic owner instead of a project.
    trait :for_course do
      project { nil }
      association :linkable, factory: :course
    end

    trait :for_unit do
      project { nil }
      association :linkable, factory: :course_unit
    end
  end
end
