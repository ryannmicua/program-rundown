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
Each Program stands alone and may optionally link to at most one Event.
A Program with no Event is normal.
For a multi-day gathering, each day or session has a separate, complete Program.
Several Programs may share a day, such as Sabbath Morning Program and Sabbath Afternoon Program.
Within an Event, Programs may optionally be grouped by date; each Program keeps its own date.

Example: the "Divine Service" sheet handed to attendees at a 10:30 a.m. worship service is one Program.

### Event

An **Event** is an optional, lightweight organizing record for related Programs.
It has a name, optional dates, and an ordered list of linked Programs.
Examples include a multi-day `Example Conference` and `Sabbath`.
An Event can link Programs across several days, including several Programs on one day.
Within the Event, Programs may optionally be grouped by their own dates.
For example, a `Sabbath` Event can group Vesper under Friday's date and Sabbath School, Divine Worship, and AY under Saturday's date.
The date groups organize the linked Programs; each Program keeps its own date.

A Program links directly to at most one Event; a Program with no Event is normal.
Linking a Program does not make it a mini-program or part of another Program.

program-rundown composes and publishes Programs; the Event only links and lists related Programs together.
It does not manage the gathering itself (venue booking, attendance, ticketing, rehearsals).

| | Event | Program |
|---|---|---|
| What it is | An optional, lightweight organizing record | A complete document describing a day or session |
| Example | `Example Conference`, linking daily and session Programs; `Sabbath`, with Programs optionally grouped by date | The printed "Divine Service" sheet |
| Who acts on it | Coordinators link and order related Programs for the Event, optionally grouping them by date; readers find them together | Coordinators write it; attendees read it |
| Relationship to publication | Only groups related Programs | Each Program can be drafted, published, and revised on its own |
| Optional link | Lists linked Programs in order, optionally grouped by date | Links to at most one Event; having no Event is normal |

### Coordinator and Reader

Two audiences use a Program in different ways.

- A **Coordinator** composes the Program: arranges sections, mini-programs, and items, fills in details, and fills in Parts when needed.
  Example: `[Coordinator name]`, credited as Program Coordinator in the footer.
- A **Reader** follows the Program during the event to know what comes next and who leads it.
  Example: an attendee holding the sheet, or someone viewing it on a phone.

A person can be both: a coordinator also reads the published Program on the day.
A coordinator of an Event can read and manage every Program in that Event, including Drafts.
A standalone Program has its own coordinator.
Signing in identifies the coordinator; a Participant or Footer coordinator credit does not grant access.
Note that "Congregation" also appears inside the sample Program as a Part value (the people who sing a hymn).
Those people are [Participants](#participant) because they have a Part, even when they are also Readers.

Coordinators need to:

1. **Manage Parts.**
   Add, update, or clear assignments on Items, Sections, other blocks, and Footer standing roles.
   Use the existing [Part](#part) value rules.
2. **Easily move Parts around.**
   Relocate a Part assignment; the Part identifies who does an activity or leads a block, while the Item identifies the activity.
   A Part may move within its Program or between Programs linked to the same Event, never across Events.
   Moving to an occupied spot adds a parallel Part there; the existing Part stays intact.
   The coordinator decides whether to move either Part elsewhere.
3. **See which Parts have no assignment yet.**
   A blank Part has no assignment, even if it has Part extra info.
   Role-only Parts without a named holder also count as unassigned.
4. **Get a list of Participants.**
   Use [Participant](#participant) for the people taking Parts, including people represented by group text.
   The list covers the whole Event and can be filtered to one Program.
   A standalone Program offers the same list for its own Parts.
5. **Copy Parts and reuse templates.**
   Copy a Part without its Participant or copy everything, as defined under [Part](#part).
   Create a new Program from a [Program template](#program-template).

### Draft and Published

A Program has a **status**.

- **Draft**: a working document the coordinator has not released as the published listing.
  Coordinators may read a Draft.
- **Published**: the coordinator has released it to readers, for printing or sharing.
  Anyone with its link can read it without signing in.
  Published Programs have no discoverable public directory; readers reach them through shared links.
  A shared Event link may list that Event's published Programs, while omitting its Drafts.

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
The link points directly to the Event; the Program keeps its own Header date.
The Event may optionally group its Programs by those dates.
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
Each day or session is a separate Program linked to one optional Event.
The order below is the Event's list of linked Programs, not nested Sections or mini-programs.

```text
Event: Example Conference (optional dates supplied: July 28–August 1)
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

Participant shared by Day 1 and Day 2: role Speaker; name Alex Placeholder;
  position Education Director; organization Example Conference
Keynote Message's Part displays: Alex Placeholder
```

Each linked Program is complete, with its own Header, ordered content, and publication status.
The abbreviated Programs omit their remaining content for readability.
Day 4 and Vesper share July 31; the Sabbath Morning and Sabbath Afternoon Programs share August 1.
The Event may optionally group its linked Programs by those dates.
Each can stand alone without the Event link.
Mini-programs remain available for a program within a single Program, as in the Community Gathering example above.

### Sabbath example grouped by date

A `Sabbath` Event links Vesper, Sabbath School, Divine Worship, and AY Programs across weeks.
This example groups the linked Programs by their own dates.
Vesper has Friday's date; Sabbath School, Divine Worship, and AY have Saturday's date.
Each linked Program remains complete, with its own Header, content, and publication status.

```text
Event: Sabbath
  Linked Programs, grouped by date and ordered within each date:
    Friday, November 6, 2026:
      1. Program: Vesper
           Header: VESPER; date Friday, November 6, 2026
           Footer: Program Coordinator | Riley Placeholder
    Saturday, November 7, 2026:
      1. Program: Sabbath School
           Header: SABBATH SCHOOL; date Saturday, November 7, 2026
      2. Program: Divine Worship
           Header: DIVINE WORSHIP; date Saturday, November 7, 2026
           Section: The Spoken Word; Part: Alex Placeholder
      3. Program: AY
           Header: AY; date Saturday, November 7, 2026
    Friday, November 13, 2026:
      1. Program: Vesper
           Header: VESPER; date Friday, November 13, 2026
           Footer: Program Coordinator | Sam Sample
    Saturday, November 14, 2026:
      1. Program: Sabbath School
           Header: SABBATH SCHOOL; date Saturday, November 14, 2026
      2. Program: Divine Worship
           Header: DIVINE WORSHIP; date Saturday, November 14, 2026
           Section: The Spoken Word; Part: Jamie Example
      3. Program: AY
           Header: AY; date Saturday, November 14, 2026
```

Each Program links directly to the same `Sabbath` Event.
The date groups use the Programs' Header dates.
The abbreviated Programs omit their remaining content for readability.
Each week's Divine Worship is a separate Program, even though the title repeats.
Publishing or revising one Program does not publish or revise another week's Program.
The Event only groups Programs; each Program can stand alone without its Event link.

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

### Event link

An **Event link** optionally associates a complete Program directly with an Event.
A Program links to at most one Event, and having no Event is normal.
An Event has a name, optional dates, and an ordered list of linked Programs, optionally grouped by the Programs' dates.
Each Program keeps its own Header, content, and publication status.
One day may have several Programs; the date does not identify a single Program.
Example: `Sabbath Morning Program` and `Sabbath Afternoon Program` share August 1 and link to `Example Conference`.
Another example: Vesper on November 6 and Divine Worship on November 7 both link to `Sabbath`, grouped under their respective dates.

The Event only links and lists the Programs together, optionally grouped by date.
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
An Item, block, or Footer entry can hold several parallel Parts at the same spot.
Each Part keeps its own value and extra info; parallel Parts do not create another activity or imply a sequence.

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

For coordinator review, an **unassigned Part** includes a blank Part value: no assignment has been supplied.
Omitting the optional Part value also leaves no assignment; this does not require every Item or block to have one.
Part extra info alone does not assign anyone.
Role-only values remain valid and count as unassigned when they have no named holder.
This includes a standalone role, a structured role without a name, or a role reference to a Participant without a name.

Moving a Part relocates its value and extra info and clears only that source Part.
An occupied destination keeps every existing Part, including extra-info-only Parts, and receives the moved Part alongside them.
Nothing is replaced, swapped, or combined.
Preview, published reading, and print show all parallel Parts at that spot.
The coordinator can select and move each Part separately.

Copying a Part uses the same destination boundaries as moving: within its Program or between Programs in the same Event.
The source stays intact, and an occupied destination retains its Parts.
The coordinator chooses one of two options:

- **Copy without Participant:** copy Part extra info and any explicit role placeholder, clearing the Participant reference and person or group assignment.
  Clear direct names and free-text assignments too; do not guess a role from text.
  Retain a referenced Participant's role as a standalone role, without copying the person's descriptive fields.
- **Copy everything:** copy the value, display mode, and Part extra info.
  A Participant reference continues to use the same shared definition; it does not create another person.

Both options copy the assignment only; Item labels, Detail, content order, and activities stay in place.

### Participant

A **Participant** is a person who has a Part in the Program.
Use Participant for the person and Part for the assignment of who does an activity or leads a block.
A Part may still contain group text such as `Congregation`; the people taking that Part are Participants.
It does not need to list their names.
The same participant can appear many times: in Items, in Sections, and in the Footer.
A Participant is defined once and referenced by Parts by name or by role, so repeated assignments reuse the same participant details.
Participant definitions can be shared between Programs, including standalone Programs the coordinator may manage.
Reusing a definition is an explicit choice; matching names or roles never establishes identity.
Moving or fully copying a referenced Part between permitted Programs keeps the same definition.
Editing a shared definition updates all its references, including references in Published Programs.
Before saving, show the coordinator which Programs will be affected, within their access.
Definition selection and reuse must respect coordinator access; sharing adds no public Participant directory or Draft access.

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

### Participant list

The **Participant list** helps a coordinator see who is taking Parts and where each assignment appears.
An Event list covers its linked Programs, with a filter for one Program.
A standalone Program offers the same list for its own content, including nested blocks and Footer roles.
Only assignments in Programs the coordinator may access contribute to the list.

| Group | What appears | How repeated assignments appear |
|---|---|---|
| Named Participants | Named, referenced Participant definitions, with role and optional descriptive fields | One entry per definition, with every Program and Part location beneath it |
| Text assignments | Free-text values and direct structured names, including `Jamie Example`, `Congregation`, and `Pat Example and Lee Example` | One entry per source Part, labelled as text; preserve the complete value |
| Awaiting a name | Standalone roles, structured roles without names, and references to unnamed Participants | Group references by definition; keep direct roles tied to their source Parts |

Each entry links to its source Parts, including parallel Parts.
List entries follow their first assignment in Event Program order, then content order, with Footer entries last.
The Program filter keeps only matching assignments and their locations.
Unused definitions and blank or extra-info-only Parts do not appear; the unassigned-Part review still covers those Parts.
Treat `TBA` as text, without guessing whether it names a person.

This design groups only identities the coordinator explicitly chose to share.
It keeps every assignment traceable and avoids merging different people with the same name.
Group text stays useful without requiring a directory of individuals.
An unnamed role stays visible as work awaiting a name, without counting it as a named person.

### Program template

A **Program template** is a reusable starting structure for a new Program.
It can describe the Header, Sections, mini-programs, Items, Parts, and Footer needed for a recurring kind of listing.
Example: `Example Worship Template` supplies the structure for a new `Divine Worship` Program.
A coordinator selects an available template and creates a separate Draft, then supplies the new Program's title and optional date.
The new Program has its own coordinator access and optional Event link; it never inherits publication status or access grants from a source Program.
Changes to the new Program do not alter the template or other Programs created from it.
A template is not a published Program, a mini-program, a recurrence rule, or a copy-forward operation on last week's Programs.

The small first slice covers creating a Program from an available template.
Who supplies and manages templates, and which dates, times, Parts, and Participant details carry over, remain [open template questions](#open-template-questions).

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
An Event coordinator has access to every linked Program; a standalone Program uses its own coordinator.
Publication status describes whether the listing has been released.
For example, a coordinator may prepare a Draft on Wednesday and release the completed listing on Friday.
Later edits replace the published Program, so readers receive the current listing.
Anyone with the published link can read and print it without signing in.
There is no version history or new published version per edit.

## 6. Glossary

| Term | Definition | Example |
|---|---|---|
| Program | A complete, standalone document listing a day or session's flow and who does each part; optionally linked to at most one Event | The "Divine Service" sheet |
| Program template | A reusable starting structure from which a coordinator creates a separate Draft Program | `Example Worship Template` |
| Event | An optional, lightweight organizing record with a name, optional dates, and an ordered list of linked Programs, optionally grouped by their dates; no event logistics | `Example Conference`, July 28–August 1; `Sabbath`, grouping Programs by date |
| Event link | An optional, direct association between a Program and at most one Event | `Sabbath Morning Program` linked to `Example Conference`; Divine Worship linked to `Sabbath` |
| Coordinator | A person who manages every Program in their Event, or their own standalone Program, including Drafts, Parts, and Participant lists | A program coordinator |
| Reader | Anyone who follows a published Program by link, without signing in | An attendee holding the sheet |
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
| Parallel Parts | Separate Parts at the same Item, block, or Footer spot, each retaining its value and extra info | Moving a second assignment onto `Prayer` keeps both |
| Unassigned Part | A blank or omitted Part value, even with Part extra info, or a role-only value without a named holder | An empty Part on `Prayer`; role `Speaker` without a named holder |
| Part extra info | Optional title, topic, name, or description of the part being performed | Sermon title `A Life of Service`; description `Venue: Example Hall` |
| Participant | A person defined once for reuse across Programs by Parts by name or role; may carry a role, optional name, position, and organization | Role `Speaker`, name `Alex Placeholder`, position `Education Director`, organization `Example Conference` |
| Participant list | A coordinator's list of named Participants, text assignments, and roles awaiting a name, with source locations; Event-wide with a Program filter, or standalone | A shared `Jamie Example` definition with reading and prayer locations |
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
    Event coordinators can read and manage every linked Program, including Drafts (Q1).
    Standalone Programs have their own coordinator.
    Anyone can read a Published Program by link without signing in (Q2); there is no discoverable public directory.
11. **Multi-day listings.**
    Use separate, complete Programs for each day or session, each able to stand alone.
    Several Programs may share a day, such as Sabbath Morning and Sabbath Afternoon Programs.
    Each Program may optionally link to at most one Event; a Program with no Event is normal.
    The Event only links and lists Programs together, optionally grouped by their dates; event logistics remain outside this project.
    Use mini-programs only for a program within a single Program.
12. **Part extra info.**
    A Part may optionally include a title, topic, name, or description of the part being performed, including a venue description.
    Item Detail remains free text and stays available.
13. **Participant extra info and reuse.**
    Define Participants once and share definitions between Programs, referencing them from Parts by name or by role (Q5).
    A Participant can carry a role and optional name, position, and organization, alongside the existing honorific and subtitle.
14. **Programs under an Event, optionally grouped by date.**
    An Event remains a lightweight organizing record with a name, optional dates, and an ordered list of linked Programs.
    An Event can link Programs across several days, optionally grouped by each Program's own date.
    Each Program links directly to at most one Event; a Program with no Event is normal.
    Each Program keeps its own date, content, and publication status.
    A `Sabbath` Event can group Friday's Vesper under Friday's date and Sabbath School, Divine Worship, and AY under Saturday's date.
15. **Coordinator capabilities.**
    Coordinators can manage Parts, easily move Parts around, see Parts with no assignment yet, and get a list of Participants.
    These capabilities use the existing Part and Participant definitions.
16. **Part move boundaries.**
    A Part may move within its own Program and between Programs linked to the same Event, never across Events.
    A standalone Program permits moves within itself; it does not gain a cross-Program move boundary.
    A Part remains the assignment, and an Item remains the activity.
17. **Role-only Parts in the unassigned list.**
    Blank or omitted Part values count as unassigned, including Parts with only extra info.
    Role-only Parts without a named holder also count as unassigned.
    These include standalone roles, structured roles without names, and role references to Participants without names.
    Such role-only Parts remain valid values.
18. **Participant list scope.**
    The list covers the whole Event and can be filtered to one Program.
    The Event-wide list uses its linked Programs, optionally grouped by their dates; it does not introduce occurrences.
    Standalone Programs offer their own list (Q4).
    Group named references by definition, preserve direct text per Part, and show unnamed roles under `Awaiting a name`.
    Every entry retains its assignment locations; names alone never merge identities.
19. **Occupied destinations and Part copies.**
    Moving onto an occupied spot preserves every Part there as parallel Parts (Q3).
    The coordinator decides whether to move an existing Part elsewhere.
    Copies leave the source intact and offer `Copy without Participant` or `Copy everything` (Q5).
    A full copy retains the shared Participant reference; a copy without Participant clears person or group assignments and retains explicit role placeholders.
20. **Program templates.**
    A coordinator can create a separate Draft Program from an available reusable template.
    Template management and carry-over choices remain open below; recurrence and copy-forward stay deferred.

### Open template questions

Q1–Q5 are settled above; only these new template choices remain for the captain.

| ID | Question | Affected work |
|---|---|---|
| T1 | Who supplies templates? May coordinators save a Program as a template, edit templates, and share them across Events or coordinators? | U12 template availability and management boundary |
| T2 | Which Header dates/times, Parts, and extra info carry into a new Program? Should Participant assignments be cleared, optional, or retained as shared references? | U12 creation preview and carry-over rules |

### Deferred capabilities

1. **Recurrence and dated occurrences — deferred.**
   Recurrence patterns and dated Event occurrences are deferred entirely for now, not rejected.
   The current model only links Programs directly to an Event, with optional grouping by the Programs' own dates.
2. **Copy-forward — deferred.**
   Copying a previous week's or occurrence's Programs forward is deferred for now, not rejected.
   The current model does not include a copy-forward capability.

### Resolved choices

1. **Preparing the next occurrence.**
   Resolved by deferring recurrence and occurrences entirely.
   Explicit and automatic occurrence creation are both out of scope for now.
2. **Copying a previous occurrence's Programs.**
   Resolved by deferring copy-forward entirely.
   Which content, Parts, dates, or publication status would carry over is outside the current scope.
