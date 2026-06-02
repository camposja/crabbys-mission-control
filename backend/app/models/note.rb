class Note < ApplicationRecord
  # The reusable, polymorphic note model. Distinguishes source/course material
  # from the user's own personal notes. Owners today: Course, CourseUnit.
  NOTE_TYPES = %w[course_material personal].freeze

  belongs_to :notable, polymorphic: true

  validates :body, presence: true
  validates :note_type, inclusion: { in: NOTE_TYPES }
  # Scoped per owner — same external_id may exist under different notables.
  validates :external_id, uniqueness: { scope: [:notable_type, :notable_id], allow_nil: true }

  scope :course_material, -> { where(note_type: "course_material") }
  scope :personal,        -> { where(note_type: "personal") }
  scope :ordered,         -> { order(created_at: :asc) }
end
