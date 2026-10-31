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

Example: the "Divine Service" sheet handed to attendees at a 10:30 a.m. worship service is one Program.

### Event

An **Event** is the real-world gathering that a Program describes: a worship service, a wedding, a graduation, a conference session.
The event happens once, at a place and time; the Program is a description of its flow.
program-rundown composes and publishes Programs.
It does not manage the event itself (venue booking, attendance, ticketing, rehearsals).

| | Event | Program |
|---|---|---|
| What it is | The gathering | The document about the gathering |
| Example | Saturday worship at 10:30 a.m. | The printed "Divine Service" sheet |
| Who acts on it | Everyone present | Coordinators write it; attendees read it |
| Relationship to publication | Takes place in the real world | Can be drafted, published, and revised |

### Coordinator and Reader

Two audiences use a Program in different ways.

- A **Coordinator** composes the Program: picks the sections and items, fills in hymn titles, and assigns people.
  Example: `[Coordinator name]`, credited as Program Coordinator in the footer.
- A **Reader** follows the Program during the event to know what comes next and who leads it.
  Example: an attendee holding the sheet, or someone viewing it on a phone.

A person can be both: a coordinator also reads the published Program on the day.
Note that "Congregation" also appears inside the sample Program as an assignee (the people who sing a hymn).
That use is a [Participant](#participant), not the Reader audience, even though it is the same people.

### Draft and Published

A Program has a **status**.

- **Draft**: a working document the coordinator has not released as the published listing.
  Draft access permissions remain an open choice.
- **Published**: the coordinator has released it to readers, for printing or sharing.

Example: on Wednesday the coordinator drafts Saturday's Program with "Speaker: TBA".
On Friday the coordinator fills in the speaker and publishes it.

What happens when a coordinator changes a Program after publishing is an [open question](#7-open-questions).

### Fits any program, not only worship

The model describes any program that follows the same shape: a header, ordered sections of ordered items, each item with someone responsible, and a list of standing roles.
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

## 2. Anatomy of a program list

The sample sheet has five structural parts, top to bottom.
The outline below rebuilds the sample with placeholder names; the hymn titles are kept because they are the public titles of common hymns.

```text
                       DIVINE SERVICE                     <- Header: title
                         10:30 a.m.                       <- Header: start time

WORSHIP THROUGH PRAISE                                    <- Section heading
  Praise Songs                              Congregation  <- Item: label + assignee

CALL TO WORSHIP                                 Presider  <- Section heading + section assignee
  *Introit         "Holy, Holy, Holy"       Congregation  <- Item: marker + label + detail + assignee
  Hymn of Celebration "We Love Thy Sabbath Lord" Congregation
  Invocation                                     Speaker  <- assignee is a role reference
  Hymn of Adoration                         Congregation
  Scripture Reading                       Jamie Example   <- assignee is a named person
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

THE SPOKEN WORD                     DR. ALEX PLACEHOLDER  <- Featured block: heading + featured person
                         Education Director, Example Conference  <- Featured block: subtitle

  Hymn of Consecration                      Congregation  <- Items after the featured block
  Hymn of Hope     "The Mission"            Congregation
  Benediction                                    Speaker

            Presider | Sam Sample                         <- Footer: standing role + person
     Choristers | Pat Example and Lee Example             <- one role, two people
            Pianist | Morgan Pianist
     Deacons | Chris Example & Drew Example
 Program Coordinator | Robin Sample & Jordan Sample
```

Section order gives the sequence of groups; item order gives the sequence within a group.
The featured block's relationship to sections and items remains open question 4.

## 3. Vocabulary

Each term below has a definition and an example from the sample (with placeholder names).

### Header

The **Header** is the top block that identifies the Program.
It holds:

- **Title** (required): the name of the program as readers see it.
  Example: `DIVINE SERVICE`.
- **Start time** (optional): when the event starts.
  Example: `10:30 a.m.`.
- **Date** (when included): the day of the event.
  Example: `7 November 2026` (illustrative; absent from the sample).
  The sample shows no date; the reason is unknown.
  The event date differs from the date a coordinator publishes the document.
  Whether the event date is required remains open.
- Other optional header lines, such as a venue or a theme, may appear on other programs; the sample has none.

### Section

A **Section** is an ordered group of items under one heading.
A Program has one or more sections, and their order is the order of the event.

Attributes:

- **Heading**: the section's title, usually in capitals.
  Example: `WORSHIP THROUGH PRAISE`, `CALL TO WORSHIP`.
- **Section assignee** (optional): a person or role who leads the whole section, shown on the heading line.
  Example: `CALL TO WORSHIP` shows `Presider` on its heading line, meaning the presider leads that part.
- **Items**: the ordered items in the section.
  A section can have a single item, such as `WORSHIP THROUGH HIS WORDS` with only `Ministry in Song`.

### Item

An **Item** is one part of a section: one thing that happens, in order.
An item can wrap across several printed lines; a line break does not create another item.
"Item" is the proposed term; "element" and "line" are the alternatives (see [open questions](#7-open-questions)).

Attributes:

- **Label** (required): what happens.
  Example: `Hymn of Celebration`, `Invocation`, `Offertory Prayer`.
- **Detail** (optional): the specific content of this item, such as a hymn title or a scripture reference.
  The sample shows hymn titles in quotes and italics; this is a presentation convention.
  Example: `"We Love Thy Sabbath Lord"` on the `Hymn of Celebration` item.
  Another Program might pair `Scripture Reading` with the detail `Psalm 100:1–5`.
  Many items have no detail, such as `Invocation`.
- **Assignee** (usually present): who performs the item.
  Example: `Congregation`, `Jamie Example`, `Speaker`.
- **Markers** (optional): symbols that tag the item.
  Example: the `*` before `*Introit`.

### Assignee

An **Assignee** is whoever is responsible for an item, a section, or a featured block.
The sample shows four kinds:

| Kind | Meaning | Example |
|---|---|---|
| Person | A named participant | `Jamie Example` on `Scripture Reading` |
| Several people | Two or more named participants together | `Pat Example and Lee Example` |
| Group | A collective, not a list of names | `Congregation`, `Everyone`, `Choir` |
| Role reference | A role whose holder is named elsewhere in the Program | `Speaker` on `Invocation`; `Presider` on `CALL TO WORSHIP` |

A role reference lets the coordinator name the person once and refer to the role everywhere else.
In the sample, `Speaker` appears to refer to the featured person, and `Presider` to the footer entry `Presider | Sam Sample`.
Those connections are implicit in the printed listing; rules for resolving them remain open.

### Participant

A **Participant** is a person or group taking part in the flow described by the Program.
Use Participant for who takes part and Assignee for their responsibility in an item, section, or featured block.
Example: `Congregation` is a group Participant assigned to `Praise Songs`.
The same participant can appear many times: in items, in the featured block, and in the footer.

Example: `Morgan Pianist` performs `Offertory Music` and is also credited as `Pianist | Morgan Pianist` in the footer.
`Jamie Example` performs both `Scripture Reading` and `Pastoral Prayer`.

A participant may carry an **honorific** and a **subtitle**, which matter mostly in the featured block.
Example: honorific `Dr.`, subtitle `Education Director, Example Conference`.

### Role

A **Role** is a named function in the Program that a participant fills.
Example: `Presider`, `Speaker`, `Pianist`, `Choristers`, `Deacons`, `Program Coordinator`.

A role is not a person.
For example, different participants may hold `Speaker` in successive Programs.
A Program need not include every role shown in the sample.

### Standing role

A **Standing role** is a role held for the whole Program rather than for one item.
Standing roles appear in the [Footer](#footer).
Example: `Presider`, `Pianist`, `Deacons`.

A standing role can be held by one or more participants.
Example: `Deacons | Chris Example & Drew Example`.

### Marker

A **Marker** is a short symbol before an item's label that tells readers something about that item.
Example: `*` before `*Introit`, `*Prayer Hymn`, `*Pastoral Prayer`, and `*Hymn of Response`.

A **Marker legend** explains what a marker means.
For example, a coordinator could define `* = Please stand` in another Program.
The sample has no visible legend, so this document leaves its marker meaning unspecified.

### Featured block

A **Featured block** is a highlighted part of the Program that presents one featured participant, usually the main speaker.
It is larger and more prominent than an item.

Attributes:

- **Heading**: what the featured part is.
  Example: `THE SPOKEN WORD`.
- **Featured participant**: shown large, with an optional honorific.
  Example: `DR. ALEX PLACEHOLDER`.
- **Subtitle** (optional): the participant's title or affiliation.
  Example: `Education Director, Example Conference`.

The featured block has no label-detail-assignee lines of its own.
The `Speaker` references on `Invocation` and `Benediction` appear to point to the featured participant.
The subtitle describes that participant; it differs from an item detail such as a hymn or scripture title.

### Footer

The **Footer** is the closing block that lists the Program's standing roles and who holds them.
Each line is one standing role and its participants, written `Role | Participant(s)`.

Example:

```text
Presider | Sam Sample
Choristers | Pat Example and Lee Example
Program Coordinator | Robin Sample & Jordan Sample
```

The separator (`|`) and the joiner between names (`and`, `&`) are presentation choices, not data.
Footer entries credit people rather than adding activities to the event sequence.

## 4. What the sample shows beyond the basic shape

These details in the sample affect the model and are easy to miss.

- **A section heading can carry an assignee.**
  `CALL TO WORSHIP` shows `Presider` on its heading line, so the presider leads the whole section.
- **Items can follow the featured block without a new heading.**
  `Hymn of Consecration`, `Hymn of Hope`, and `Benediction` come after `THE SPOKEN WORD` with no heading of their own.
  They may belong to the featured section, or to an unheaded closing section (see [open questions](#7-open-questions)).
- **One assignee can be several people.**
  `Pat Example and Lee Example` hold `Choristers` together.
- **Assignees mix people, groups, and roles in the same section.**
  `CALL TO WORSHIP` has `Congregation`, `Speaker`, and `Jamie Example` as assignees.
- **No item shows its own time.**
  Only the header has a time.

## 5. Program lifecycle

A coordinator composes a Draft and publishes it for readers.
Publication status describes whether the listing has been released; it does not establish access permissions or revision rules.
For example, a coordinator may prepare a Draft on Wednesday and release the completed listing on Friday.
Whether later corrections replace that listing or create another published version remains open.

## 6. Glossary

| Term | Definition | Example |
|---|---|---|
| Program | The composed document listing the order of an event and who does each part | The "Divine Service" sheet |
| Event | The real-world gathering a Program describes; not managed by program-rundown | Saturday worship at 10:30 a.m. |
| Coordinator | A person who composes and publishes a Program | A program coordinator |
| Reader | A person who follows a published Program | An attendee holding the sheet |
| Status | Whether a Program is a draft or published | Draft |
| Header | The top block: title, start time, optional date | `DIVINE SERVICE`, `10:30 a.m.` |
| Section | An ordered group of items under a heading | `CALL TO WORSHIP` |
| Heading | The title of a section or featured block | `WORSHIP THROUGH GIVING` |
| Section assignee | A person or role who leads a whole section | `Presider` on `CALL TO WORSHIP` |
| Item | One ordered part of a section, regardless of printed line breaks | `Hymn of Celebration` item |
| Label | What happens in an item | `Offertory Prayer` |
| Detail | Optional specific content of an item, such as a hymn title | `"Holy, Holy, Holy"` |
| Assignee | Who leads or performs an item, section, or featured block: people, a group, or a role reference | `Congregation` |
| Participant | A person or group taking part in the described flow | `Jamie Example`, `Congregation` |
| Group | A collective assignee that is not a list of names | `Congregation` |
| Role | A named function a participant fills | `Speaker` |
| Role reference | An assignee that names a role whose holder appears elsewhere | `Speaker` on `Benediction` |
| Standing role | A role held for the whole Program, credited in the footer | `Pianist` |
| Marker | A symbol before an item label that tags the item | `*` |
| Marker legend | The meaning of each marker | `* = Please stand` (illustrative; absent from the sample) |
| Featured block | A highlighted part that presents a featured participant | `THE SPOKEN WORD` |
| Honorific | A courtesy title before a participant's name | `Dr.` |
| Subtitle | A participant's title or affiliation shown under the name | `Education Director, Example Conference` |
| Footer | The closing list of standing roles and their holders | `Presider \| Sam Sample` |

## 7. Open questions

The model has real choices on these points; each needs a decision before the data model.

1. **Time per item.**
   Is time only a property of the Program (the start time), or can each item or section also have a time or duration?
   The sample shows only a start time; another Program might need per-item times.
2. **Date.**
   Is a date a required part of the Program, optional, or taken from the Event?
   The sample shows no date.
3. **Markers.**
   Is there a fixed set of markers with a standard legend, or does each Program define its own markers and legend as free text?
   Should the legend print on the Program?
4. **Featured block.**
   Is the featured block a special kind of Section, a special kind of Item, or an attribute of a Section?
   Do the items after it (`Hymn of Consecration`, `Hymn of Hope`, `Benediction`) belong to it, or to an unheaded section?
5. **Unheaded sections.**
   Can a Section have no heading?
6. **Term for a within-section line.**
   Item, Element, or Line?
   This document uses Item: "Line" describes layout, and "Element" is too generic.
7. **Assignments.**
   May an item omit its assignee or combine people, groups, and role references?
   Must role references resolve to named holders within the same Program?
8. **Detail kinds.**
   Is a detail free text, or does it have kinds (song title, scripture reference, note) that change how it displays?
9. **Publication.**
   Who may read a Draft?
   Do later changes replace the published listing or create another version, and how do readers know it changed?
