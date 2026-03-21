class CronJob < ApplicationRecord
  validates :name,     presence: true
  validates :schedule, presence: true
  validates :command,  presence: true

  scope :enabled, -> { where(enabled: true) }
end
