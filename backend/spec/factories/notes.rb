FactoryBot.define do
  factory :note do
    association :notable, factory: :course
    note_type { "course_material" }
    body { "Some note body." }

    trait :personal do
      note_type { "personal" }
      body { "My own thoughts." }
    end

    trait :course_material do
      note_type { "course_material" }
    end

    trait :for_unit do
      association :notable, factory: :course_unit
    end

    trait :with_external_id do
      sequence(:external_id) { |n| "note-#{n}" }
    end
  end
end
