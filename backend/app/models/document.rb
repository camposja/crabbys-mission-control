class Document < ApplicationRecord
  belongs_to :project, optional: true

  validates :title, presence: true

  scope :by_agent,   ->(id)  { where(agent_id: id) }
  scope :recent,     ->      { order(created_at: :desc) }
end
