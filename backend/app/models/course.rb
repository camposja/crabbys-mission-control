class Course < ApplicationRecord
  STATUSES = %w[active archived completed].freeze

  # TODO(media): notes & links are already polymorphic. Future media (videos,
  # files) can attach the same way — e.g. a `MediaItem` with
  # material_type: link|video|file|text, `has_many :media_items, as: :mediable` —
  # with no schema rewrite to courses/units.
  has_many :course_units, -> { order(:position) }, dependent: :destroy
  has_many :notes, as: :notable, dependent: :destroy
  has_many :links, as: :linkable, dependent: :destroy

  validates :title, presence: true
  validates :status, inclusion: { in: STATUSES }
  validates :external_id, uniqueness: { allow_nil: true }

  scope :active_first, -> { order(Arel.sql("status = 'active' DESC"), created_at: :desc) }

  # Counts surfaced in the list view. notes_count/links_count include unit-level
  # records so a course card reflects everything saved under it.
  def units_count
    course_units.size
  end

  def notes_count
    notes.count + Note.where(notable_type: "CourseUnit", notable_id: course_units.select(:id)).count
  end

  def links_count
    links.count + Link.where(linkable_type: "CourseUnit", linkable_id: course_units.select(:id)).count
  end
end
