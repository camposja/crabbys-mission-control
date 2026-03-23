FactoryBot.define do
  factory :project do
    sequence(:name) { |n| "Project #{n}" }
    status { "active" }
  end
end
