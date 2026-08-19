class Setting < ApplicationRecord
  # The keys the app actually reads and writes. The settings API accepts only
  # these — it used to accept `permit!`, so any client could store arbitrary
  # keys. Add a key here (and use it) before the API will take it.
  ALLOWED_KEYS = %w[
    usage_threshold_daily_cost
    usage_threshold_hourly_tokens
    usage_threshold_monthly_cost
  ].freeze

  validates :key, presence: true, uniqueness: true

  def self.get(key)
    find_by(key: key)&.value
  end

  def self.set(key, value)
    find_or_initialize_by(key: key).tap do |s|
      s.value = value
      s.save!
    end
  end
end
