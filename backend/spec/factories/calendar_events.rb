FactoryBot.define do
  factory :calendar_event do
    sequence(:title) { |n| "Event #{n}" }
    starts_at { 1.hour.from_now }
    status    { "scheduled" }
    source    { "manual" }

    trait :running do
      status { "running" }
    end

    trait :completed do
      status { "completed" }
    end

    trait :failed do
      status { "failed" }
    end

    trait :missed do
      status { "missed" }
    end

    trait :cancelled do
      status { "cancelled" }
    end

    trait :past do
      starts_at { 2.hours.ago }
    end

    trait :with_task do
      association :task
    end

    trait :with_project do
      association :project
    end

    trait :with_cron_job do
      association :cron_job
      source { "cron_job" }
    end

    trait :agent_spawn do
      source   { "agent_spawn" }
      agent_id { "agent-#{SecureRandom.hex(4)}" }
    end
  end
end
