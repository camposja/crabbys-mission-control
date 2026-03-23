class Task < ApplicationRecord
  include AASM

  PRIORITIES = %w[low medium high urgent].freeze

  belongs_to :project, optional: true

  validates :title, presence: true
  validates :priority, inclusion: { in: PRIORITIES }, allow_nil: true

  # AASM state machine — forward-only for the planned workflow,
  # but drag-and-drop can bypass via direct update (see TasksController#move)
  aasm column: :status, whiny_transitions: false do
    state :backlog, initial: true
    state :in_progress
    state :review
    state :done

    event :start do
      transitions from: :backlog, to: :in_progress,
                  after: :record_transition
    end

    event :submit_for_review do
      transitions from: :in_progress, to: :review,
                  after: :record_transition
    end

    event :complete do
      transitions from: :review, to: :done,
                  after: :record_transition
    end

    # Free-move event used by drag-and-drop (allows any direction)
    event :move_to_status do
      transitions from: %i[backlog in_progress review done],
                  to:   %i[backlog in_progress review done],
                  after: :record_transition
    end
  end

  scope :by_status,   ->(s) { where(status: s) }
  scope :ordered,     -> { order(:position, :created_at) }
  scope :for_crabby,  -> { where(assignee: "crabby").where.not(status: "done") }
  scope :orphaned_agents, -> {
    where(openclaw_agent_id: nil)
      .where(agent_status: %w[spawn_requested running in_progress])
  }
  scope :active_agents, -> {
    where.not(openclaw_agent_id: nil)
      .where.not(agent_status: %w[completed failed spawn_failed])
  }

  after_update_commit :broadcast_update

  private

  def record_transition
    update_column(:state_changed_at, Time.current)
  end

  def broadcast_update
    ActionCable.server.broadcast("task_updates", {
      event: "task_updated",
      task:  as_json
    })
  end
end
