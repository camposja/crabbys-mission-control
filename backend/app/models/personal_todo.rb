# Personal to-do items for Jose only.
# This model is intentionally separate from the OpenClaw Task/Kanban system.
# Crabby / OpenClaw agents should NOT read, process, or act on these items.
class PersonalTodo < ApplicationRecord
  validates :title, presence: true

  # Default view: active + done (not archived)
  scope :visible,   -> { where(archived: false).order(Arel.sql("done ASC, position ASC, created_at ASC")) }
  scope :pending,   -> { where(done: false, archived: false).order(:position, :created_at) }
  scope :completed, -> { where(done: true, archived: false).order(completed_at: :desc) }
  scope :archived,  -> { where(archived: true).order(archived_at: :desc) }

  before_save :set_completed_at
  before_save :set_archived_at

  private

  def set_completed_at
    if done_changed?
      self.completed_at = done? ? Time.current : nil
    end
  end

  def set_archived_at
    if archived_changed?
      self.archived_at = archived? ? Time.current : nil
    end
  end
end
