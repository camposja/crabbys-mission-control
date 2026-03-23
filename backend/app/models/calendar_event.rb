class CalendarEvent < ApplicationRecord
  STATUSES = %w[scheduled running completed failed missed cancelled].freeze
  SOURCES  = %w[manual task_run cron_job proactive_job agent_spawn reminder].freeze

  belongs_to :task,     optional: true
  belongs_to :project,  optional: true
  belongs_to :cron_job, optional: true

  validates :title,     presence: true
  validates :starts_at, presence: true
  validates :status,    inclusion: { in: STATUSES }
  validates :source,    inclusion: { in: SOURCES }

  scope :upcoming,   -> { where("starts_at >= ?", Time.current).order(:starts_at) }
  scope :for_range,  ->(from, to) { where(starts_at: from..to) }
  scope :pending,    -> { where(status: %w[scheduled running]) }
  scope :for_agent,  ->(id) { where(agent_id: id) }
  scope :for_task,   ->(id) { where(task_id: id) }
end
