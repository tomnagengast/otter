# Agent Context

## Conventions

### SQL

<important>
when writing new models or adding new columns to an existing model, be sure to use psql to instrospect the source table schema to prevent hallucinated columns that do not exist or incorrect data type usage.
</important>

- All SQL should be written in lowercase unless incompatible with the query engine - GOOD: `select * from table`, BAD: `SELECT * FROM table`.
- Prefer readable alias names over abbreviations or overly-verbose alternatives - GOOD: `... from _tmp_organizations as organizations`, BAD: `... from _tmp_organizations as to`.
- Leverage CTEs to make queries more readable - prefer over subqueries or inline complexity.
- Use "import CTEs" to make downstream queries more readable - e.g. `with organizations as (select * from {{ ref('stg_organiztaions') }}, ...`
- Query should always end with a `final` CTE and `... select * from final`
- Prefer group/order by `n` over specifying the column name - GOOD: `group by 1, 2, 3`, BAD: `group by foo, bar, baz`.
