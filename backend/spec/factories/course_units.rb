FactoryBot.define do
  factory :course_unit do
    association :course
    sequence(:title) { |n| "Unit #{n}" }
    unit_type { "topic" }
    status { "active" }

    trait :sequential do
      unit_type { "sequential" }
    end

    trait :with_external_id do
      sequence(:external_id) { |n| "unit-#{n}" }
    end
  end
end
