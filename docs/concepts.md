# Program rundown: concepts and vocabulary

This document defines the terms program-rundown uses for the structure of a program list.
It settles the vocabulary first, so the data model and the app can build on it later.
It is conceptual: it names things and their attributes, and it does not prescribe storage, schema, or UI.

All names of people in the examples are placeholders.
The reference image is not included in this repository.

## 1. Core concepts

### Program

A **Program** is the composed document that lists, in order, what happens during an event and who does each part.
People also call it a program rundown, a program listing, an order of service, or a bulletin insert.
In this project, "program" always means the document, never the gathering.

A Program may contain Sections, mini-programs, or both.
A mini-program is a program within a program, with its own header, optional times, and ordered children.
Sections and mini-programs can nest; the model supports more than a flat list.
Each Program stands alone and may optionally link to a one-off Event or a specific occurrence of a recurring Event.
A Program with no Event is normal.
For a multi-day gathering, each day or session has a separate, complete Program.
Several Programs may share a day, such as Sabbath Morning Program and Sabbath Afternoon Program.
A recurring Event groups each occurrence's Programs separately; each Program keeps its own date.

Example: the "Divine Service" sheet handed to attendees at a 10:30 a.m. worship service is one Program.

### Event

An **Event** is an optional, lightweight organizing record for related Programs.
It may be **one-off**, such as a multi-day Executive Committee meeting, or **recurring**, such as a weekly `Sabbath`.
A one-off Event has a name, optional dates, and an ordered list of linked Programs.
A recurring Event has a name, a recurrence, and dated occurrences; each occurrence has its own ordered list of linked Programs.
A one-off Event or an occurrence can link Programs across several days, including several Programs on one day.

A **Recurrence** describes how an Event repeats, such as `every week on Saturday` for `Sabbath`.
An **Occurrence** is one dated instance of a recurring Event, such as `Sabbath — November 7, 2026`.
Each week's occurrence groups that week's Vesper, Sabbath School, Divine Worship, and AY Programs.
The occurrence's date identifies that week's gathering; each Program keeps its own date, including Friday's Vesper.

A Program belongs to at most one Event grouping: a one-off Event or a specific occurrence of a recurring Event.
For a recurring Event, the Program links to the specific occurrence, which identifies the Event it belongs to.
It does not also link separately to the series or another occurrence.
Linking a Program does not make it a mini-program or part of another Program.

program-rundown composes and publishes Programs; the Event only links and lists related Programs together.
It does not manage the gathering itself (venue booking, attendance, ticketing, rehearsals).

| | Event | Program |
|---|---|---|
| What it is | An optional organizing record, either one-off or recurring | A complete document describing a day or session |
| Example | `Example Conference`, linking daily and session Programs; `Sabbath`, grouping each week's Programs through an occurrence | The printed "Divine Service" sheet |
| Who acts on it | Coordinators link and order related Programs for the Event or occurrence; readers find them together | Coordinators write it; attendees read it |
| Relationship to publication | Only groups Programs, directly or through occurrences | Each Program can be drafted, published, and revised on its own |
| Optional link | Lists Programs in order for the one-off Event or each occurrence | Belongs to a one-off Event, a specific recurring Event occurrence, or neither |

### Coordinator and Reader

Two audiences use a Program in different ways.

- A **Coordinator** composes the Program: arranges sections, mini-programs, and items, fills in details, and fills in Parts when needed.
  Example: `[Coordinator name]`, credited as Program Coordinator in the footer.
- A **Reader** follows the Program during the event to know what comes next and who leads it.
  Example: an attendee holding the sheet, or someone viewing it on a phone.

A person can be both: a coordinator also reads the published Program on the day.
Note that "Congregation" also appears inside the sample Program as a Part value (the people who sing a hymn).
Those people are [Participants](#participant) because they have a Part, even when they are also Readers.

### Draft and Published

A Program has a **status**.

- **Draft**: a working document the coordinator has not released as the published listing.
  Coordinators may read a Draft.
- **Published**: the coordinator has released it to readers, for printing or sharing.

Example: on Wednesday the coordinator drafts Saturday's Program with "Speaker: TBA".
On Friday the coordinator fills in the speaker and publishes it.

Later edits replace the published Program.
Publication does not create a version history or a new version for each edit.

### Fits any program, not only worship

The model describes programs with a header, ordered sections or mini-programs, and items with optional Parts.
Programs may also credit standing roles in a footer.
Worship services are the first and main case, so examples use worship terms.
Nothing in the vocabulary depends on worship.

Example of the same shape outside worship (a school graduation):

```text
COMMENCEMENT EXERCISES
4:00 p.m.

OPENING
  *Processional                                Graduates
  *National Anthem                             Glee Club
  Opening Remarks                              Principal

RECOGNITION
  Presentation of Candidates                   Registrar
  Conferring of Diplomas                       Principal

KEYNOTE ADDRESS                      ALEX EXAMPLE
                                     Guest Speaker, Example University

  Closing Song      "Alma Mater"               Everyone

Master of Ceremonies | Sam Sample
Program Coordinator | Riley Placeholder
```

`KEYNOTE ADDRESS` can be a Section with the block label `featured` and a Part showing `Alex Example`.
The closing song can belong to an unheaded Section.
The leading `*` in `*Processional` and `*National Anthem` is text the coordinator typed into each Item label.

## 2. Anatomy of a program list

The sample sheet has a Header, Sections containing Items, and a Footer.
An optional Event link groups a complete Program with other Programs; it sits outside the Program's internal structure.
The link points to a one-off Event or a specific recurring Event occurrence; the Program keeps its own Header date.
The outline below rebuilds the sample with placeholder names; the hymn titles are kept because they are the public titles of common hymns.

```text
                       DIVINE SERVICE                     <- Header: title
                         10:30 a.m.                       <- Header: start time

WORSHIP THROUGH PRAISE                                    <- Section heading
  Praise Songs                              Congregation  <- Item: label + Part

CALL TO WORSHIP                                 Presider  <- Section heading + Part
  *Introit         "Holy, Holy, Holy"       Congregation  <- Item: label (including *) + detail + Part
  Hymn of Celebration "We Love Thy Sabbath Lord" Congregation
  Invocation                                     Speaker  <- Part shows a role without a name
  Hymn of Adoration                         Congregation
  Scripture Reading                       Jamie Example   <- Part shows a placeholder name
  *Prayer Hymn  "As We Come to You in Prayer" Congregation
  *Pastoral Prayer                        Jamie Example
  *Hymn of Response  "O Thou Who Heareth"   Congregation

WORSHIP THROUGH GIVING
  Thoughts on Stewardship                  Casey Sample
  Offertory Music                          Morgan Pianist
  Hymn of Gratitude "Praise God, From Whom All Blessings" Congregation
  Offertory Prayer                         Casey Sample

WORSHIP THROUGH HIS WORDS
  Ministry in Song                         Taylor Singer

THE SPOKEN WORD                     DR. ALEX PLACEHOLDER  <- Section: heading + Part; block label "featured"
                         Education Director, Example Conference  <- Participant subtitle
  Sermon title: A Life of Service                         <- Optional Part extra info

  Hymn of Consecration                      Congregation  <- Items in an unheaded closing Section
  Hymn of Hope     "The Mission"            Congregation
  Benediction                                    Speaker

            Presider | Sam Sample                         <- Footer: standing role + Part
     Choristers | Pat Example and Lee Example             <- one role, two people
            Pianist | Morgan Pianist
     Deacons | Chris Example & Drew Example
 Program Coordinator | Robin Sample & Jordan Sample
```

Section order gives the sequence of groups; item order gives the sequence within a group.
The closing Items illustrate an unheaded Section; their grouping does not require a printed heading.
The leading `*` characters belong to the Item labels and have no separate modeled attribute.
The added sermon-title line illustrates optional Part extra info; it is not from the sample.
The speaker's Participant definition carries role `Speaker`, name `Alex Placeholder`, and honorific `Dr.`.
Its position is `Education Director` and its organization is `Example Conference`; these can form the displayed subtitle.
Parts on `Invocation`, `THE SPOKEN WORD`, and `Benediction` can reference that Participant by role `Speaker`.
Each then displays `Alex Placeholder`, with the honorific where appropriate, instead of the role label.
If the Participant has no name yet, those role references display `Speaker`.
The sermon title describes the Part; the position and organization describe the Participant.

The following outline illustrates nesting beyond the sample sheet.
The block labels and structural notes explain the concepts; they are not prescribed printed text.

```text
Program: Community Gathering (start 9:00 a.m.; end 12:00 p.m.; date omitted)
  Header: COMMUNITY GATHERING
  Section: Welcome (start 9:00 a.m.; end omitted)
    Item: Opening Remarks (start omitted; end omitted; Part: Host)
  Mini-program: Morning Service (start 9:30 a.m.; end 11:00 a.m.; block label: worship)
    Header: MORNING SERVICE
    Section: Praise (start omitted; end 10:00 a.m.)
      Item: Opening Hymn (start 9:30 a.m.; end 9:35 a.m.; Part: Congregation)
    Mini-program: Dedication (start omitted; end omitted)
      Header: DEDICATION
      Section: no heading (start omitted; end omitted)
        Item: Prayer (start omitted; end 10:15 a.m.; Part: blank)
  Section: no heading (start omitted; end omitted)
    Item: Closing Remarks (start 11:50 a.m.; end omitted; Part: Host)
```

At every level, start and end are independently optional.
Ordering still describes the flow when no times are supplied.

### Multi-day example

The [reference site's Daily Schedule](https://executivecommittee.adventist.asia/) runs from DAY 1, Tuesday, July 28, through DAY 5, Saturday, August 1.
It lists Vesper on July 31 and separate Sabbath Morning and Sabbath Afternoon Programs on August 1.
Its registration entry runs from noon to 4:30 p.m. and includes a venue; other entries carry message titles and descriptions.
These fit optional start/end times and Part extra info.
Listing a venue or an arrival activity describes the flow; it does not manage bookings, registration, or transport.

This shortened outline adapts that schedule, using placeholder names, venues, and message titles.
Each day or session is a separate Program linked to one optional, one-off Event.
The order below is the Event's list of linked Programs, not nested Sections or mini-programs.

```text
Event: Example Conference (one-off; optional dates supplied: July 28–August 1)
  Linked Programs, in order:
    1. Program: Day 1
         Header: DAY 1; date Tuesday, July 28
         Section: Arrival and Registration
           Item: Registration (start 12:00 noon; end 4:30 p.m.)
             Part: Registration Host; extra info: description "Venue: Example Hotel"
         Section: Opening Ceremony (start 7:00 p.m.; end 9:00 p.m.)
           Section: Evening Worship
             Item: Keynote Message
               Part: reference Participant by role Speaker; extra info: title "A Life of Service"
         Footer: Program Coordinator | Riley Placeholder
    2. Program: Day 2
         Header: DAY 2; date Wednesday, July 29
    3. Program: Day 3
         Header: DAY 3; date Thursday, July 30
    4. Program: Day 4
         Header: DAY 4; date Friday, July 31
    5. Program: Vesper
         Header: VESPER; date Friday, July 31; start 6:30 p.m.; end omitted
    6. Program: Sabbath Morning Program
         Header: SABBATH MORNING PROGRAM; date Saturday, August 1
    7. Program: Sabbath Afternoon Program
         Header: SABBATH AFTERNOON PROGRAM; date Saturday, August 1

Participant defined once in Day 1: role Speaker; name Alex Placeholder;
  position Education Director; organization Example Conference
Keynote Message's Part displays: Alex Placeholder
```

Each linked Program is complete, with its own Header, ordered content, and publication status.
The abbreviated Programs omit their remaining content for readability.
Day 4 and Vesper share July 31; the Sabbath Morning and Sabbath Afternoon Programs share August 1.
Each can stand alone without the Event link.
Mini-programs remain available for a program within a single Program, as in the Community Gathering example above.

### Recurring Sabbath example

A recurring `Sabbath` Event organizes a separate occurrence for each week.
Each occurrence groups that week's Vesper, Sabbath School, Divine Worship, and AY Programs.
The occurrence date is Saturday; its Vesper Program has the preceding Friday's date.
Each linked Program remains complete, with its own Header, content, and publication status.

```text
Event: Sabbath (recurring)
  Recurrence: every week on Saturday
  Occurrence: Sabbath — November 7, 2026
    Linked Programs, in order:
      1. Program: Vesper
           Header: VESPER; date Friday, November 6, 2026
           Footer: Program Coordinator | Riley Placeholder
      2. Program: Sabbath School
           Header: SABBATH SCHOOL; date Saturday, November 7, 2026
      3. Program: Divine Worship
           Header: DIVINE WORSHIP; date Saturday, November 7, 2026
           Section: The Spoken Word; Part: Alex Placeholder
      4. Program: AY
           Header: AY; date Saturday, November 7, 2026
  Occurrence: Sabbath — November 14, 2026
    Linked Programs, in order:
      1. Program: Vesper
           Header: VESPER; date Friday, November 13, 2026
           Footer: Program Coordinator | Sam Sample
      2. Program: Sabbath School
           Header: SABBATH SCHOOL; date Saturday, November 14, 2026
      3. Program: Divine Worship
           Header: DIVINE WORSHIP; date Saturday, November 14, 2026
           Section: The Spoken Word; Part: Jamie Example
      4. Program: AY
           Header: AY; date Saturday, November 14, 2026
```

Each Program links only to its own week's occurrence of `Sabbath`.
The abbreviated Programs omit their remaining content for readability.
Each week's Divine Worship is a separate Program, even though the title repeats.
Publishing or revising one Program does not publish or revise another week's Program.
The Event and its occurrences only group Programs; each Program can stand alone without its Event link.
This example does not settle whether occurrences or their Programs are created automatically or copied from a previous week.

## 3. Vocabulary

Each term below has a definition and an example from the sample or an additional illustration, using placeholder names.

### Header

The **Header** is the top block that identifies a Program or mini-program.
It holds:

- **Title** (required): the name of the program as readers see it.
  Example: `DIVINE SERVICE`.
- **Start time** (optional): when the Program or mini-program starts.
  Example: `10:30 a.m.`.
- **End time** (optional): when the Program or mini-program ends.
  Example: `12:00 p.m.` (illustrative; absent from the sample).
- **Date** (optional): the day described by the Program or mini-program.
  Example: `7 November 2026` (illustrative; absent from the sample).
  The event date differs from the date a coordinator publishes the document.
- Other optional header lines, such as a venue or a theme, may appear on other programs; the sample has none.

Neither time depends on the other: a Header may show only a start, only an end, both, or neither.

### Mini-program

A **Mini-program** is a program within a Program, with its own Header and ordered children.
It may contain Sections, further mini-programs, or both.
A Section may also contain a mini-program among its children.

A mini-program has an optional start, optional end, and optional header date, just as a Program does.
It may carry an optional [Block label](#block-label-class) for styling or its own settings.
Example: a `Morning Service` mini-program within a `Community Gathering`, containing a `Dedication` mini-program.
Mini-programs describe content within a single Program.
Separate daily or session Programs link through an optional Event instead.

### Recurrence

A **Recurrence** is the repeating pattern of a recurring Event.
Example: `Sabbath` repeats `every week on Saturday`.
The recurrence describes when the Event repeats; it does not specify Program content, Parts, or publication status.

### Occurrence

An **Occurrence** is one dated instance of a recurring Event.
It belongs to one Event and has a date and an ordered list of linked Programs.
Example: `Sabbath — November 7, 2026` groups that week's Vesper, Sabbath School, Divine Worship, and AY Programs.
The next week's occurrence has its own Programs.
The occurrence date does not require every linked Program to have that same date; Vesper can be on the preceding Friday.
An occurrence groups complete Programs outside their internal structure; it is not a mini-program.

### Event link

An **Event link** optionally associates a complete Program with a one-off Event or a specific occurrence of a recurring Event.
A Program belongs to at most one such grouping, and having no Event is normal.
A one-off Event has a name, optional dates, and an ordered list of its Programs.
A recurring Event supplies the name and recurrence; each occurrence supplies its date and ordered list of Programs.
Linking to an occurrence identifies both the Event and the dated instance; a separate link to the recurring Event is unnecessary.
Each Program keeps its own Header, content, and publication status.
One day may have several Programs; the date does not identify a single Program.
Example: `Sabbath Morning Program` and `Sabbath Afternoon Program` share August 1 and link to `Example Conference`.
Another example: Vesper on November 6 and Divine Worship on November 7 both link to the `Sabbath — November 7, 2026` occurrence.

The Event only links and lists the Programs together, directly or through occurrences.
It does not manage venues, attendance, tickets, rehearsals, or other logistics.

### Section

A **Section** is an ordered group of Items, with an optional heading.
Sections may also contain nested Sections or mini-programs, so grouping can continue within a Program.
The order of children describes the sequence within their parent.

Attributes:

- **Heading** (optional): the section's visible title, usually in capitals.
  Example: `WORSHIP THROUGH PRAISE`, `CALL TO WORSHIP`.
- **Part** (optional): the assignment of who leads the whole section.
  Example: `CALL TO WORSHIP` shows `Presider` on its heading line, meaning the presider leads that part.
- **Start time** and **end time** (each optional): the section's own times; either may appear alone.
- **Block label** (optional): a class-like label for styling or settings, such as `featured`.
- **Children**: the ordered Items, nested Sections, or mini-programs in the section.
  A section can have a single item, such as `WORSHIP THROUGH HIS WORDS` with only `Ministry in Song`.

An unheaded Section groups its Items without showing a title.
Example: the closing `Hymn of Consecration`, `Hymn of Hope`, and `Benediction` can form one unheaded Section.

### Item

An **Item** is one activity within a Section: one thing that happens, in order.
An item can wrap across several printed lines; a line break does not create another item.
Item is the term for a within-section line; printed lines describe layout rather than separate activities.

Attributes:

- **Label** (required): what happens.
  Example: `Hymn of Celebration`, `Invocation`, `Offertory Prayer`.
- **Detail** (optional): free text for the item's content, such as a hymn title, scripture reference, or note.
  The sample shows hymn titles in quotes and italics; this is a presentation convention.
  Example: `"We Love Thy Sabbath Lord"` on the `Hymn of Celebration` item.
  Another Program might pair `Scripture Reading` with the detail `Psalm 100:1–5`.
  Many items have no detail, such as `Invocation`.
- **Part** (optional): the assignment of who performs the item; it may be blank.
  Example: `Congregation`, `Jamie Example`, `Speaker`.
- **Start time** and **end time** (each optional): the item's own times; either may appear alone.

Detail has no predefined kinds that determine its display.
Characters such as the leading `*` in `*Introit` are simply part of the Item label.

### Part

A **Part** is an Item's, Section's, or block's assignment of who does it, including a mini-program's assignment when needed.
People can ask, "What is your part in the program?" or "Whose part is it now?"
Here, Part names the assignment; Item names the activity.

A Part is optional and need not identify a person.
Its value may be blank, free text, a role, a structured object with a role and an optional name, or a Participant reference.
A Part can reference a Participant by name or by role, using the Participant defined once for reuse.

| Kind | Meaning | Example |
|---|---|---|
| Blank | No assignment text supplied | An Item with its Part left empty |
| Free text | Any coordinator-entered text, including names or groups | `Jamie Example`, `Pat Example and Lee Example`, `Congregation`, `TBA` |
| Role | A function, with no named holder required | `Speaker` on `Invocation`; `Presider` on `CALL TO WORSHIP` |
| Structured role and optional name | Display the name when present; otherwise display the role label | Role `Speaker`, name `Alex Placeholder` displays `Alex Placeholder`; role `Speaker` alone displays `Speaker` |
| Participant reference by name | Use the Participant identified by that name | Reference `Alex Placeholder`, whose definition carries role `Speaker`, position `Education Director`, and organization `Example Conference` |
| Participant reference by role | Display the referenced Participant's name when available; otherwise display the role label | Reference role `Speaker`: display `Alex Placeholder` when named, otherwise `Speaker` |

For example, a Part value of `{role: "Speaker", name: "Alex Placeholder"}` displays `Alex Placeholder`.
A value of `{role: "Speaker"}` displays `Speaker`; a blank name also falls back to the role label.
These are conceptual examples of the value, not a storage schema.

A role used in a Part does not need to resolve to a named holder elsewhere in the Program.
`Speaker` remains valid even when the coordinator has not named a speaker in a Section or Footer.
A standalone role value remains allowed alongside references to defined Participants.

A Part may also include optional **Part extra info**: a title, topic, name, or description of the part being performed.
Examples: sermon title `A Life of Service`, topic `Service in the Community`, or description `Venue: Example Hall`.
The name of a part describes what is presented; a Participant's name identifies who presents it.
Part extra info supplements the assignment and can accompany a blank Part value, without requiring a named Participant.
An Item's Detail remains optional free text for the activity; adding Part extra info does not remove or restrict Detail.

### Participant

A **Participant** is a person who has a Part in the Program.
Use Participant for the person and Part for the assignment of who does an activity or leads a block.
A Part may still contain group text such as `Congregation`; the people taking that Part are Participants.
It does not need to list their names.
The same participant can appear many times: in Items, in Sections, and in the Footer.
A Participant is defined once and referenced by Parts by name or by role, so repeated assignments reuse the same participant details.

A Participant definition can carry:

- **Role**: the function the Participant fills, such as `Speaker` or `Pianist`.
- **Name** (optional): the person's name, such as `Alex Placeholder`.
- **Position** (optional): the person's position, such as `Education Director`.
- **Organization** (optional): the person's organization, such as `Example Conference`.

The name may be omitted while a role awaits a named holder.
When a Part references that Participant by role, display the name if available; otherwise display the role label.

Example: `Morgan Pianist` performs `Offertory Music` and is also credited as `Pianist | Morgan Pianist` in the footer.
`Jamie Example` performs both `Scripture Reading` and `Pastoral Prayer`.

A participant may carry an **honorific** and a **subtitle**, such as those shown in the Section labeled `featured`.
Example: honorific `Dr.`, subtitle `Education Director, Example Conference`.
The subtitle may combine position and organization; those details describe the person rather than the part's title, topic, name, or description.

### Role

A **Role** is a named function in the Program that a participant may fill.
Example: `Presider`, `Speaker`, `Pianist`, `Choristers`, `Deacons`, `Program Coordinator`.

A role is not a person.
For example, different participants may hold `Speaker` in successive Programs.
A Program need not include every role shown in the sample.
A role may appear in a Part without a named holder.
A Part may also use a role to reference a defined Participant, displaying that Participant's name when available.

### Standing role

A **Standing role** is a function that applies to the whole Program rather than to one Item.
Standing roles appear in the [Footer](#footer).
Example: `Presider`, `Pianist`, `Deacons`.

A standing role can be held by one or more participants.
Example: `Deacons | Chris Example & Drew Example`.

### Block label (class)

A **Block** is a grouping in the Program, such as a Section or mini-program.
A **Block label** is an optional label that works like an HTML class.
It lets a Section, mini-program, or other block be styled differently or carry its own settings.
It can apply to an unheaded Section as well as one with a heading.

The block label is separate from a visible heading and from an Item's label, which says what happens.
For example, `THE SPOKEN WORD` is a Section heading; `featured` is an example block label for that Section.
`featured` is not a hardcoded type and imposes no special structure.
The Section can show a Part with `Dr. Alex Placeholder` and the participant subtitle `Education Director, Example Conference`.
It may also contain Items, like any other Section.
The subtitle describes the participant's position or organization; an Item's Detail remains free text for that activity.
A Part's optional title, topic, name, or description supplies extra information about the part being performed.

### Footer

The **Footer** is the closing block that credits the Program's standing roles and their Parts.
Each line pairs a role with its Part, written `Role | Part`.
The Part follows the same flexible value rules: blank, text, a role, a structured role with an optional name, or a Participant reference.
Footer Parts can reference Participants by name or by role and may include optional Part extra info.

Example:

```text
Presider | Sam Sample
Choristers | Pat Example and Lee Example
Program Coordinator | Robin Sample & Jordan Sample
```

The separator (`|`) and the joiner between names (`and`, `&`) are presentation choices, not data.
Footer entries credit responsibilities rather than adding activities to the event sequence.

## 4. What the sample shows beyond the basic shape

These details in the sample affect the model and are easy to miss.

- **A section heading can carry a Part.**
  `CALL TO WORSHIP` shows `Presider` on its heading line, so the presider leads the whole section.
- **Items can follow a Section labeled `featured` without a new heading.**
  `Hymn of Consecration`, `Hymn of Hope`, and `Benediction` come after `THE SPOKEN WORD` with no heading of their own.
  This outline groups them in an unheaded closing Section; a Section labeled `featured` could also contain Items.
- **One Part can name several people.**
  `Pat Example and Lee Example` hold `Choristers` together.
- **Parts mix names, groups, and roles in the same section.**
  `CALL TO WORSHIP` has `Congregation`, `Speaker`, and `Jamie Example` as Part values.
- **No item shows its own time.**
  Only the header has a time.
  Programs, mini-programs, Sections, and Items nevertheless each support an optional start and optional end.

## 5. Program lifecycle

A coordinator composes a Draft and publishes it for readers.
Coordinators may read a Draft before publication.
Publication status describes whether the listing has been released.
For example, a coordinator may prepare a Draft on Wednesday and release the completed listing on Friday.
Later edits replace the published Program, so readers receive the current listing.
There is no version history or new published version per edit.

## 6. Glossary

| Term | Definition | Example |
|---|---|---|
| Program | A complete, standalone document listing a day or session's flow and who does each part; optionally linked to a one-off Event or a specific recurring Event occurrence | The "Divine Service" sheet |
| Event | An optional organizing record for related Programs; one-off with optional dates and an ordered Program list, or recurring with a recurrence and dated occurrences; no event logistics | `Example Conference`, July 28–August 1; weekly `Sabbath` |
| Recurrence | The repeating pattern of a recurring Event | `every week on Saturday` for `Sabbath` |
| Occurrence | One dated instance of a recurring Event, with its own ordered list of linked Programs | `Sabbath — November 7, 2026` |
| Event link | An optional association between a Program and at most one grouping: a one-off Event or a specific recurring Event occurrence | `Sabbath Morning Program` linked to `Example Conference`; Divine Worship linked to `Sabbath — November 7, 2026` |
| Coordinator | A person who composes and publishes a Program and may read it as a Draft | A program coordinator |
| Reader | A person who follows a published Program | An attendee holding the sheet |
| Status | Whether a Program is a draft or published | Draft |
| Draft | A working Program that Coordinators may read before publication | Wednesday's unfinished Saturday listing |
| Header | The identifying block of a Program or mini-program: title, optional start, optional end, optional date | `DIVINE SERVICE`, `10:30 a.m.` |
| Mini-program | A program within a single Program, with its own Header, optional times, and ordered children; nesting is supported | `Morning Service` within `Community Gathering` |
| Section | An ordered group of Items, optionally headed; may contain nested Sections or mini-programs | `CALL TO WORSHIP`; an unheaded closing Section |
| Heading | A Section's optional visible title | `WORSHIP THROUGH GIVING` |
| Block | A grouping such as a Section or mini-program | Section headed `THE SPOKEN WORD` |
| Block label (class) | An optional class-like label for a block's styling or settings, separate from its heading | `featured` |
| Item | One ordered activity within a Section, regardless of printed line breaks | `Hymn of Celebration` item |
| Item label | What happens in an Item; any leading symbols are ordinary text | `Offertory Prayer`, `*Introit` |
| Detail | Optional free text for an Item | `"Holy, Holy, Holy"`, `Psalm 100:1–5` |
| Part | The optional assignment of who does an Item or leads a block; accepts blank, text, role, role with optional name, or a Participant reference | Role reference `Speaker` displays the Participant's name when available, otherwise `Speaker` |
| Part extra info | Optional title, topic, name, or description of the part being performed | Sermon title `A Life of Service`; description `Venue: Example Hall` |
| Participant | A person defined once for reuse by Parts by name or role; may carry a role, optional name, position, and organization | Role `Speaker`, name `Alex Placeholder`, position `Education Director`, organization `Example Conference` |
| Participant reference | A Part identifies a defined Participant by name or by role | Name `Alex Placeholder` or role `Speaker` |
| Position | A Participant's optional position | `Education Director` |
| Organization | A Participant's optional organization | `Example Conference` |
| Group | Text naming people who share a Part, without listing each person | `Congregation` |
| Role | A named function usable as a standalone Part value or a reference to a Participant; no name required | `Speaker` |
| Standing role | A function applying to the whole Program, credited in the footer | `Pianist` |
| Start time / end time | Independently optional times on a Program, mini-program, Section, or Item | Start only: `10:30 a.m.`; end only: `12:00 p.m.` |
| Date | Optional day described by a Program or mini-program Header | `7 November 2026` |
| Honorific | A courtesy title before a participant's name | `Dr.` |
| Subtitle | Participant information shown under the name, which may combine position and organization | `Education Director, Example Conference` |
| Footer | The closing list of standing roles and their Parts | `Presider \| Sam Sample` |

## 7. Decisions

### Settled decisions

Nesting is supported: a Program may contain Sections and mini-programs, and those groups may contain further groups.
A mini-program stays within a single Program and has its own Header, optional times, and ordered children.
The earlier decisions remain in place, with the additional decisions below.

1. **Time per item.**
   Programs, mini-programs, Sections, and Items may each have an optional start and an optional end.
   Neither time requires the other, and neither is required.
2. **Date.**
   The header date is optional.
3. **Leading symbols.**
   A leading `*` is ordinary text in an Item label, with no separate modeled attribute.
4. **Labels and blocks.**
   Sections, mini-programs, and other blocks may have an optional label that works like an HTML class for styling or settings.
   `featured` is only an example label, not a special type.
   The sample's speaker block is a Section with that label.
5. **Unheaded sections.**
   A Section may have no heading, as illustrated by the sample's closing Items.
6. **Term for a within-section line.**
   Use Item; wrapping across printed lines does not create additional Items.
7. **Assignments.**
   Call the assignment a Part and a person who has a Part a Participant.
   A Part is optional: blank, free text, a role, a structured role with an optional name, or a Participant reference.
   The structured value displays the name when present, otherwise the role label.
   Roles need not resolve to named holders.
   A Part can reference a Participant by name or by role; a role reference displays the Participant's name when available, otherwise the role label.
8. **Detail kinds.**
   Detail is free text, without predefined kinds.
9. **Publication.**
   Later edits replace the published Program; there is no version history or new version per edit.
10. **Draft readership.**
    Coordinators may read a Draft.
11. **Multi-day listings.**
    Use separate, complete Programs for each day or session, each able to stand alone.
    Several Programs may share a day, such as Sabbath Morning and Sabbath Afternoon Programs.
    Each Program may optionally link to a one-off Event or a specific occurrence of a recurring Event; a Program with no Event is normal.
    The Event only links and lists Programs together, directly or through occurrences; event logistics remain outside this project.
    Use mini-programs only for a program within a single Program.
12. **Part extra info.**
    A Part may optionally include a title, topic, name, or description of the part being performed, including a venue description.
    Item Detail remains free text and stays available.
13. **Participant extra info and reuse.**
    Define Participants once and reference them from Parts by name or by role.
    A Participant can carry a role and optional name, position, and organization, alongside the existing honorific and subtitle.
14. **One-off and recurring Events.**
    An Event remains a lightweight organizing record with a name.
    A one-off Event has optional dates and an ordered list of linked Programs, including Programs across several days.
    A recurring Event has a recurrence describing its repeating pattern and occurrences representing individual dated instances.
    Each occurrence belongs to one Event and has its own date and ordered list of linked Programs.
    A weekly `Sabbath` occurrence groups that week's Vesper, Sabbath School, Divine Worship, and AY Programs.
    Each Program links to at most one grouping: a one-off Event or a specific recurring Event occurrence, never both or several occurrences.
    The occurrence identifies the recurring Event; a Program does not also link separately to the series.
    Each Program keeps its own date, content, and publication status; Vesper can precede the occurrence's Saturday date.

### Open choices

1. **Preparing the next occurrence.**
   Should coordinators create each occurrence explicitly, or should the recurrence create occurrences automatically?
   Defining a recurrence does not settle how Programs are created or published.
2. **Copying a previous occurrence's Programs.**
   Should a coordinator be able to copy the previous week's ordered Program set into the next occurrence?
   If so, which content, Parts, and dates carry over, and what publication status should the copies start with?
   The recurring Sabbath example does not assume copying or automatic publication.
