FactoryBot.define do
  factory :course do
    sequence(:title) { |n| "Course #{n}" }
    status { "active" }
    diploma { false }

    trait :with_diploma do
      diploma { true }
      diploma_notes { "Includes completion diploma." }
    end

    trait :with_external_id do
      sequence(:external_id) { |n| "course-#{n}" }
    end
  end
end
