class Memory < ApplicationRecord
  TYPES = %w[daily long_term journal semantic].freeze

  validates :content,     presence: true
  validates :memory_type, inclusion: { in: TYPES }, allow_nil: true

  scope :by_agent, ->(id)   { where(agent_id: id) }
  scope :by_type,  ->(type) { where(memory_type: type) }
  scope :recent,   ->       { order(created_at: :desc) }
end
