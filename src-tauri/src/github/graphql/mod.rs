use graphql_client::GraphQLQuery;

#[allow(clippy::upper_case_acronyms)]
type URI = String;
type DateTime = String;

#[derive(GraphQLQuery)]
#[graphql(
    schema_path = "src/github/graphql/schema.graphql",
    query_path = "src/github/graphql/queries/inbox.graphql",
    response_derives = "Debug, Clone, PartialEq"
)]
pub struct InboxQuery;

#[cfg(test)]
mod tests {
    use super::*;
    use graphql_client::GraphQLQuery;

    #[test]
    fn build_query_serializes_variables() {
        let body = InboxQuery::build_query(inbox_query::Variables { first: Some(25) });
        assert_eq!(body.operation_name, "InboxQuery");
        assert!(body.query.contains("reviewRequests"));
        assert!(body.query.contains("mentions"));
        assert!(body.query.contains("assignedIssues"));
        let vars = serde_json::to_value(&body.variables).unwrap();
        assert_eq!(vars["first"], 25);
    }
}
