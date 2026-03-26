class TaskNote < ApplicationRecord
  belongs_to :task

  validates :author, presence: true
  validates :body, presence: true

  scope :ordered, -> { order(created_at: :asc) }
end
