import pandas as pd
import json

def compute_composite_scores(candidates: list[dict]) -> list[dict]:
    """
    Computes the composite score for a list of candidates.
    Ranking formula: composite_score = 0.5 * normalized(binding score) + 0.35 * bbb_probability + 0.15 * qed
    Normalization method: percentile rank within the current candidate set, rescaled to 0-1 (1 is best).
    For vina_score (binding), more negative is better.
    """
    if not candidates:
        return []

    df = pd.DataFrame(candidates)
    
    if 'vina_score' not in df.columns or len(df) <= 1:
        # If there's 1 or 0 candidates, normalization is trivial (1.0 for the single candidate)
        if len(df) == 1:
            df['composite_score'] = 0.5 * 1.0 + 0.35 * df.get('bbb_probability', 0) + 0.15 * df.get('qed', 0)
            return df.to_dict('records')
        return candidates

    # Vina score: more negative = better. We want the best to have rank 1.
    df['vina_rank'] = df['vina_score'].rank(method='min', ascending=True)
    
    # Normalize to 0-1 percentile where best (rank 1) = 1.0, worst (rank N) = 0.0
    n = len(df)
    df['norm_vina'] = (n - df['vina_rank']) / (n - 1)
    
    # Calculate composite score
    df['composite_score'] = 0.5 * df['norm_vina'] + 0.35 * df['bbb_probability'] + 0.15 * df['qed']
    
    # Clean up intermediate columns
    df = df.drop(columns=['vina_rank', 'norm_vina'])
    
    return df.to_dict('records')

if __name__ == "__main__":
    # Example usage / test
    sample_data = [
        {"candidate_code": "OV-0001", "vina_score": -11.09, "bbb_probability": 0.81, "qed": 0.74},
        {"candidate_code": "OV-0002", "vina_score": -10.54, "bbb_probability": 0.90, "qed": 0.61},
        {"candidate_code": "OV-0003", "vina_score": -11.50, "bbb_probability": 0.58, "qed": 0.70},
        {"candidate_code": "OV-0004", "vina_score": -9.30,  "bbb_probability": 0.85, "qed": 0.80},
        {"candidate_code": "OV-0010", "vina_score": -6.41,  "bbb_probability": 0.95, "qed": 0.62},
    ]
    
    results = compute_composite_scores(sample_data)
    print(json.dumps(results, indent=2))
