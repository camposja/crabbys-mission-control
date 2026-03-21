class Project < ApplicationRecord
  STATUSES = %w[active paused completed archived].freeze

  has_many :tasks, dependent: :nullify

  validates :name,   presence: true
  validates :status, inclusion: { in: STATUSES }

  scope :active, -> { where(status: "active") }
end
