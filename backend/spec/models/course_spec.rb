require 'rails_helper'

RSpec.describe Course, type: :model do
  it { is_expected.to have_many(:course_units) }
  it { is_expected.to have_many(:notes) }
  it { is_expected.to have_many(:links) }

  it { is_expected.to validate_presence_of(:title) }
  it { is_expected.to validate_inclusion_of(:status).in_array(Course::STATUSES) }

  describe "external_id uniqueness" do
    it "rejects a duplicate external_id globally" do
      create(:course, external_id: "dup")
      expect(build(:course, external_id: "dup")).not_to be_valid
    end

    it "allows multiple courses with no external_id" do
      create(:course, external_id: nil)
      expect(build(:course, external_id: nil)).to be_valid
    end
  end

  describe "counts" do
    it "counts units and course+unit notes/links" do
      course = create(:course)
      unit = create(:course_unit, course: course)
      create(:note, notable: course)
      create(:note, notable: unit)
      create(:link, linkable: course, project: nil)
      create(:link, linkable: unit, project: nil)

      expect(course.units_count).to eq(1)
      expect(course.notes_count).to eq(2)
      expect(course.links_count).to eq(2)
    end
  end

  describe "dependent destroy" do
    it "removes units and their notes/links" do
      course = create(:course)
      unit = create(:course_unit, course: course)
      create(:note, notable: course)
      create(:note, notable: unit)
      create(:link, linkable: unit, project: nil)

      expect { course.destroy! }
        .to change(CourseUnit, :count).by(-1)
        .and change(Note, :count).by(-2)
        .and change(Link, :count).by(-1)
    end
  end
end
