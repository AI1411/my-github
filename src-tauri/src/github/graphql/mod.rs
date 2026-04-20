use graphql_client::{GraphQLQuery, QueryBody, Response};
#[allow(unused_imports)]
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::github::client::{ClientError, GithubClient};

#[allow(clippy::upper_case_acronyms)]
type URI = String;
type DateTime = String;

#[derive(GraphQLQuery)]
#[graphql(
    schema_path = "src/github/graphql/schema.graphql",
    query_path = "src/github/graphql/queries/inbox.graphql",
    response_derives = "Debug, Clone, PartialEq, Serialize, Deserialize"
)]
pub struct InboxQuery;

#[derive(Debug, Error)]
pub enum GraphqlError {
    #[error(transparent)]
    Client(#[from] ClientError),
    #[error("GraphQL errors: {0}")]
    Query(String),
    #[error("Missing data in GraphQL response")]
    MissingData,
}

pub async fn fetch_inbox(
    client: &GithubClient,
    first: i64,
) -> Result<inbox_query::ResponseData, GraphqlError> {
    let body: QueryBody<inbox_query::Variables> =
        InboxQuery::build_query(inbox_query::Variables { first: Some(first) });

    let resp = client
        .post("/graphql")
        .json(&body)
        .send()
        .await
        .map_err(ClientError::from)?;

    let status = resp.status();
    if !status.is_success() {
        let message = resp.text().await.unwrap_or_default();
        return Err(GraphqlError::Client(ClientError::Api {
            status: status.as_u16(),
            message,
        }));
    }

    let parsed: Response<inbox_query::ResponseData> =
        resp.json().await.map_err(ClientError::from)?;

    if let Some(errors) = parsed.errors {
        if !errors.is_empty() {
            let joined = errors
                .iter()
                .map(|e| e.message.clone())
                .collect::<Vec<_>>()
                .join("; ");
            return Err(GraphqlError::Query(joined));
        }
    }

    parsed.data.ok_or(GraphqlError::MissingData)
}

#[cfg(test)]
#[allow(dead_code)]
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

    #[test]
    fn deserializes_inbox_response_data() {
        let json = serde_json::json!({
            "reviewRequests": {
                "issueCount": 1,
                "nodes": [
                    {
                        "__typename": "PullRequest",
                        "id": "PR_kw1",
                        "number": 42,
                        "title": "Add feature",
                        "url": "https://github.com/o/r/pull/42",
                        "createdAt": "2026-04-01T00:00:00Z",
                        "updatedAt": "2026-04-02T00:00:00Z",
                        "isDraft": false,
                        "state": "OPEN",
                        "repository": { "nameWithOwner": "o/r" },
                        "author": {
                            "__typename": "User",
                            "login": "alice",
                            "avatarUrl": "https://x/y.png"
                        }
                    }
                ]
            },
            "mentions": { "issueCount": 0, "nodes": [] },
            "assignedIssues": { "issueCount": 0, "nodes": [] },
            "rateLimit": {
                "limit": 5000,
                "cost": 1,
                "remaining": 4999,
                "resetAt": "2026-04-21T01:00:00Z"
            }
        });
        let data: inbox_query::ResponseData = serde_json::from_value(json).unwrap();
        assert_eq!(data.review_requests.issue_count, 1);
        assert_eq!(data.mentions.issue_count, 0);
        assert_eq!(data.assigned_issues.issue_count, 0);
        let rl = data.rate_limit.unwrap();
        assert_eq!(rl.remaining, 4999);
    }

    #[test]
    fn graphql_error_display_contains_message() {
        let err = GraphqlError::Query("NOT_FOUND".to_string());
        assert!(format!("{}", err).contains("NOT_FOUND"));
    }

    #[test]
    fn graphql_error_missing_data_display() {
        let err = GraphqlError::MissingData;
        assert!(format!("{}", err).contains("Missing data"));
    }
}
