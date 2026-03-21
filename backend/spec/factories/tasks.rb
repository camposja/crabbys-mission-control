FactoryBot.define do
  factory :task do
    sequence(:title) { |n| "Task #{n}" }
    status    { "backlog" }
    priority  { "medium" }
    assignee  { "jose" }
    position  { 0 }
    metadata  { {} }

    trait :in_progress do
      status { "in_progress" }
    end

    trait :review do
      status { "review" }
    end

    trait :done do
      status { "done" }
    end

    trait :for_crabby do
      assignee { "crabby" }
    end

    trait :high_priority do
      priority { "high" }
    end

    trait :with_due_date do
      due_date { 7.days.from_now }
    end

    trait :with_project do
      association :project
    end
  end
end
