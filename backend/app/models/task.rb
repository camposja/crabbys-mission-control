class Task < ApplicationRecord
  STATUSES  = %w[backlog in_progress review done].freeze
  PRIORITIES = %w[low medium high urgent].freeze

  belongs_to :project, optional: true

  validates :title,  presence: true
  validates :status, inclusion: { in: STATUSES }
  validates :priority, inclusion: { in: PRIORITIES }, allow_nil: true

  scope :by_status,   ->(s) { where(status: s) }
  scope :ordered,     -> { order(:position, :created_at) }

  after_update_commit :broadcast_update

  private

  def broadcast_update
    ActionCable.server.broadcast("task_updates", {
      event: "task_updated",
      task:  as_json
    })
  end
end
