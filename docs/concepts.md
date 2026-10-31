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
  Draft access permissions remain an open choice.
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
- **Date** (optional): the day of the event.
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
Its value may be blank, free text, a role, or a structured object with a role and an optional name.

| Kind | Meaning | Example |
|---|---|---|
| Blank | No assignment text supplied | An Item with its Part left empty |
| Free text | Any coordinator-entered text, including names or groups | `Jamie Example`, `Pat Example and Lee Example`, `Congregation`, `TBA` |
| Role | A function, with no named holder required | `Speaker` on `Invocation`; `Presider` on `CALL TO WORSHIP` |
| Structured role and optional name | Display the name when present; otherwise display the role label | Role `Speaker`, name `Alex Placeholder` displays `Alex Placeholder`; role `Speaker` alone displays `Speaker` |

For example, a Part value of `{role: "Speaker", name: "Alex Placeholder"}` displays `Alex Placeholder`.
A value of `{role: "Speaker"}` displays `Speaker`; a blank name also falls back to the role label.
These are conceptual examples of the value, not a storage schema.

A role used in a Part does not need to resolve to a named holder elsewhere in the Program.
`Speaker` remains valid even when the coordinator has not named a speaker in a Section or Footer.

### Participant

A **Participant** is a person who has a Part in the Program.
Use Participant for the person and Part for the assignment of who does an activity or leads a block.
A Part may still contain group text such as `Congregation`; the people taking that Part are Participants.
It does not need to list their names.
The same participant can appear many times: in Items, in Sections, and in the Footer.

Example: `Morgan Pianist` performs `Offertory Music` and is also credited as `Pianist | Morgan Pianist` in the footer.
`Jamie Example` performs both `Scripture Reading` and `Pastoral Prayer`.

A participant may carry an **honorific** and a **subtitle**, such as those shown in the Section labeled `featured`.
Example: honorific `Dr.`, subtitle `Education Director, Example Conference`.

### Role

A **Role** is a named function in the Program that a participant may fill.
Example: `Presider`, `Speaker`, `Pianist`, `Choristers`, `Deacons`, `Program Coordinator`.

A role is not a person.
For example, different participants may hold `Speaker` in successive Programs.
A Program need not include every role shown in the sample.
A role may appear in a Part without a named holder.

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
The subtitle describes the participant; an Item's Detail remains free text for that activity.

### Footer

The **Footer** is the closing block that credits the Program's standing roles and their Parts.
Each line pairs a role with its Part, written `Role | Part`.
The Part follows the same flexible value rules: it may be blank, text, a role, or a structured role with an optional name.

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
Publication status describes whether the listing has been released.
For example, a coordinator may prepare a Draft on Wednesday and release the completed listing on Friday.
Later edits replace the published Program, so readers receive the current listing.
There is no version history or new published version per edit.
Who may read a Draft remains the only open question.

## 6. Glossary

| Term | Definition | Example |
|---|---|---|
| Program | The composed document listing the order of an event and who does each part | The "Divine Service" sheet |
| Event | The real-world gathering a Program describes; not managed by program-rundown | Saturday worship at 10:30 a.m. |
| Coordinator | A person who composes and publishes a Program | A program coordinator |
| Reader | A person who follows a published Program | An attendee holding the sheet |
| Status | Whether a Program is a draft or published | Draft |
| Header | The identifying block of a Program or mini-program: title, optional start, optional end, optional date | `DIVINE SERVICE`, `10:30 a.m.` |
| Mini-program | A program within a Program, with its own Header, optional times, and ordered children; nesting is supported | `Morning Service` within `Community Gathering` |
| Section | An ordered group of Items, optionally headed; may contain nested Sections or mini-programs | `CALL TO WORSHIP`; an unheaded closing Section |
| Heading | A Section's optional visible title | `WORSHIP THROUGH GIVING` |
| Block | A grouping such as a Section or mini-program | Section headed `THE SPOKEN WORD` |
| Block label (class) | An optional class-like label for a block's styling or settings, separate from its heading | `featured` |
| Item | One ordered activity within a Section, regardless of printed line breaks | `Hymn of Celebration` item |
| Item label | What happens in an Item; any leading symbols are ordinary text | `Offertory Prayer`, `*Introit` |
| Detail | Optional free text for an Item | `"Holy, Holy, Holy"`, `Psalm 100:1–5` |
| Part | The optional assignment of who does an Item or leads a Section or block; blank, text, role, or role with optional name | `Congregation`; role `Speaker` with no name displays `Speaker` |
| Participant | A person who has a Part in the Program | `Jamie Example` |
| Group | Text naming people who share a Part, without listing each person | `Congregation` |
| Role | A named function that may appear in a Part without a named holder | `Speaker` |
| Standing role | A function applying to the whole Program, credited in the footer | `Pianist` |
| Start time / end time | Independently optional times on a Program, mini-program, Section, or Item | Start only: `10:30 a.m.`; end only: `12:00 p.m.` |
| Date | Optional event day on a Program or mini-program Header | `7 November 2026` |
| Honorific | A courtesy title before a participant's name | `Dr.` |
| Subtitle | A participant's title or affiliation shown under the name | `Education Director, Example Conference` |
| Footer | The closing list of standing roles and their Parts | `Presider \| Sam Sample` |

## 7. Decisions and remaining open question

### Settled decisions

Nesting is supported: a Program may contain Sections and mini-programs, and those groups may contain further groups.
A mini-program has its own Header, optional times, and ordered children.
The nine earlier questions are decided as follows.

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
   A Part is optional: blank, free text, a role, or a structured role with an optional name.
   The structured value displays the name when present, otherwise the role label.
   Roles need not resolve to named holders.
8. **Detail kinds.**
   Detail is free text, without predefined kinds.
9. **Publication.**
   Later edits replace the published Program; there is no version history or new version per edit.

### Open question: Draft readership

Who may read a Draft?
Draft access permissions remain undecided.
