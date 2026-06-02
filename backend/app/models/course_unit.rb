class CourseUnit < ApplicationRecord
  UNIT_TYPES = %w[topic sequential general].freeze
  STATUSES   = %w[active archived].freeze

  belongs_to :course
  has_many :notes, as: :notable, dependent: :destroy
  has_many :links, as: :linkable, dependent: :destroy

  validates :title, presence: true
  validates :unit_type, inclusion: { in: UNIT_TYPES }
  validates :status, inclusion: { in: STATUSES }
  # Scoped per course — agents can reuse keys like "intro"/"module-1" across courses.
  validates :external_id, uniqueness: { scope: :course_id, allow_nil: true }

  before_validation :assign_position, on: :create

  scope :ordered, -> { order(:position, :created_at) }

  private

  def assign_position
    return if position.present?

    self.position = (course&.course_units&.maximum(:position) || 0) + 1
  end
end
