class Feedback < ApplicationRecord
  TYPES    = %w[bug feature improvement question].freeze
  STATUSES = %w[pending processing done failed].freeze

  validates :title,         presence: true
  validates :feedback_type, inclusion: { in: TYPES },    allow_nil: true
  validates :status,        inclusion: { in: STATUSES }, allow_nil: true

  before_create -> { self.status ||= "pending" }
  before_create -> { self.feedback_type ||= "feature" }
  before_create -> { self.metadata ||= {} }

  scope :pending,    -> { where(status: "pending") }
  scope :recent,     -> { order(created_at: :desc) }
  scope :by_type,    ->(t) { where(feedback_type: t) }
end
