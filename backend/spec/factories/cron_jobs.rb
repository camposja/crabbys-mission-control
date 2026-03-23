FactoryBot.define do
  factory :cron_job do
    sequence(:name) { |n| "Cron Job #{n}" }
    cron_expression { "*/5 * * * *" }
    command         { "echo hello" }
    enabled         { true }
    status          { "idle" }

    trait :disabled do
      enabled { false }
    end

    trait :failed do
      status        { "failed" }
      failure_count { 3 }
      last_error    { "Connection refused" }
    end

    trait :with_task do
      association :task
    end

    trait :with_project do
      association :project
    end
  end
end
