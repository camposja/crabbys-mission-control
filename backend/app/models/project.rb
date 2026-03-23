class Project < ApplicationRecord
  STATUSES = %w[active paused completed archived].freeze

  has_many :documents, dependent: :nullify
  has_many :memories, dependent: :nullify
  has_many :tasks, dependent: :nullify
  has_many :calendar_events, dependent: :nullify
  has_many :cron_jobs, dependent: :nullify

  validates :name,   presence: true
  validates :status, inclusion: { in: STATUSES }

  scope :active, -> { where(status: "active") }
end
