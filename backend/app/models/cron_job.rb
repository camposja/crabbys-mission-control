class CronJob < ApplicationRecord
  STATUSES = %w[idle active paused failed].freeze

  belongs_to :task,    optional: true
  belongs_to :project, optional: true
  has_many   :calendar_events, dependent: :nullify

  validates :name,            presence: true
  validates :cron_expression, presence: true
  validates :command,         presence: true
  validates :status,          inclusion: { in: STATUSES }

  scope :enabled, -> { where(enabled: true) }
  scope :active,  -> { where(enabled: true) }
end
