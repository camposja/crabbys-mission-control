class JobApplication < ApplicationRecord
  STATUSES = %w[applied pending started rejected interview offer withdrawn].freeze
  SOURCES = %w[assistant manual].freeze

  validates :title, :company, :status, :source, :applied_on, :external_uid, presence: true
  validates :status, inclusion: { in: STATUSES }
  validates :source, inclusion: { in: SOURCES }
  validates :external_uid, uniqueness: { scope: :source }

  scope :recent_first, -> { order(applied_on: :desc, created_at: :desc) }
  scope :for_date, ->(date) { where(applied_on: date) }

  def assistant?
    source == "assistant"
  end

  def manual?
    source == "manual"
  end
end
