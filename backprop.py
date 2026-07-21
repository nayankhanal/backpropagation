import numpy as np
import pandas as pd
import streamlit as st
import altair as alt

# ----------------------------------------------------------------------------
# Core neural network code (unchanged logic from your notebook)
# ----------------------------------------------------------------------------

def initialize_parameters(layer_dims):
    np.random.seed(3)
    parameters = {}
    L = len(layer_dims)
    for l in range(1, L):
        parameters['W' + str(l)] = np.ones((layer_dims[l - 1], layer_dims[l])) * 0.1
        parameters['b' + str(l)] = np.zeros((layer_dims[l], 1))
    return parameters


def linear_forward(A_prev, W, b):
    Z = np.dot(W.T, A_prev) + b
    return Z


def L_layer_forward(X, parameters):
    A = X
    L = len(parameters) // 2
    for l in range(1, L + 1):
        A_prev = A
        Wl = parameters['W' + str(l)]
        bl = parameters['b' + str(l)]
        A = linear_forward(A_prev, Wl, bl)
    return A, A_prev


def update_parameters(parameters, y, y_hat, A1, X, lr):
    parameters['W2'][0][0] = parameters['W2'][0][0] + (lr * 2 * (y - y_hat) * A1[0][0])
    parameters['W2'][1][0] = parameters['W2'][1][0] + (lr * 2 * (y - y_hat) * A1[1][0])
    parameters['b2'][0][0] = parameters['b2'][0][0] + (lr * 2 * (y - y_hat))

    parameters['W1'][0][0] = parameters['W1'][0][0] + (lr * 2 * (y - y_hat) * parameters['W2'][0][0] * X[0][0])
    parameters['W1'][0][1] = parameters['W1'][0][1] + (lr * 2 * (y - y_hat) * parameters['W2'][0][0] * X[1][0])
    parameters['b1'][0][0] = parameters['b1'][0][0] + (lr * 2 * (y - y_hat) * parameters['W2'][0][0])

    parameters['W1'][1][0] = parameters['W1'][1][0] + (lr * 2 * (y - y_hat) * parameters['W2'][1][0] * X[0][0])
    parameters['W1'][1][1] = parameters['W1'][1][1] + (lr * 2 * (y - y_hat) * parameters['W2'][1][0] * X[1][0])
    parameters['b1'][1][0] = parameters['b1'][1][0] + (lr * 2 * (y - y_hat) * parameters['W2'][1][0])


def train(df, epochs, lr):
    parameters = initialize_parameters([2, 2, 1])
    history = []
    for i in range(epochs):
        Loss = []
        for j in range(df.shape[0]):
            X = df[['cgpa', 'profile_score']].values[j].reshape(2, 1)
            y = df[['lpa']].values[j][0]

            y_hat, A1 = L_layer_forward(X, parameters)
            y_hat = y_hat[0][0]

            update_parameters(parameters, y, y_hat, A1, X, lr)
            Loss.append((y - y_hat) ** 2)

        history.append({'epoch': i + 1, 'loss': np.array(Loss).mean()})
    return parameters, history


# ----------------------------------------------------------------------------
# Streamlit UI
# ----------------------------------------------------------------------------

st.set_page_config(page_title="Manual Neural Net from Scratch", layout="centered")

st.title("Neural Network Built From Scratch (NumPy Only)")
st.caption(
    "A 2 -> 2 -> 1 network (no ML framework) predicting LPA from CGPA and profile score. "
    "Forward pass and backpropagation are both hand-written — this app trains it live."
)

st.subheader("Training data")
default_df = pd.DataFrame(
    [[8, 8, 4], [7, 9, 5], [6, 10, 6], [5, 12, 7]],
    columns=['cgpa', 'profile_score', 'lpa']
)
df = st.data_editor(default_df, num_rows="dynamic", use_container_width=True)

st.subheader("Hyperparameters")
col1, col2 = st.columns(2)
with col1:
    epochs = st.slider("Epochs", min_value=1, max_value=200, value=50, step=1)
with col2:
    lr = st.select_slider(
        "Learning rate",
        options=[0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05],
        value=0.001,
    )

if st.button("Train network", type="primary"):
    if df.isnull().values.any() or df.shape[0] < 2:
        st.error("Please make sure the data table has at least 2 complete rows.")
    else:
        parameters, history = train(df, epochs, lr)
        st.session_state["parameters"] = parameters
        st.session_state["history"] = history
        st.session_state["df"] = df

if "history" in st.session_state:
    history_df = pd.DataFrame(st.session_state["history"])
    parameters = st.session_state["parameters"]
    trained_df = st.session_state["df"]

    st.subheader("Training loss over epochs")
    chart = (
        alt.Chart(history_df)
        .mark_line(point=True)
        .encode(x="epoch:Q", y="loss:Q")
        .properties(height=300)
    )
    st.altair_chart(chart, use_container_width=True)

    final_loss = history_df["loss"].iloc[-1]
    st.metric("Final epoch loss (MSE)", f"{final_loss:.4f}")

    st.subheader("Learned parameters")
    pcol1, pcol2 = st.columns(2)
    with pcol1:
        st.markdown("**W1** (input → hidden)")
        st.write(parameters["W1"])
        st.markdown("**b1**")
        st.write(parameters["b1"])
    with pcol2:
        st.markdown("**W2** (hidden → output)")
        st.write(parameters["W2"])
        st.markdown("**b2**")
        st.write(parameters["b2"])

    st.subheader("Predictions vs actual")
    preds = []
    for j in range(trained_df.shape[0]):
        X = trained_df[['cgpa', 'profile_score']].values[j].reshape(2, 1)
        y_hat, _ = L_layer_forward(X, parameters)
        preds.append(y_hat[0][0])
    result_df = trained_df.copy()
    result_df["predicted_lpa"] = np.round(preds, 3)
    st.dataframe(result_df, use_container_width=True)

    st.subheader("Try a prediction")
    ccol1, ccol2 = st.columns(2)
    with ccol1:
        cgpa_in = st.number_input("CGPA", min_value=0.0, max_value=10.0, value=7.5)
    with ccol2:
        profile_in = st.number_input("Profile score", min_value=0.0, max_value=15.0, value=8.5)
    X_new = np.array([[cgpa_in], [profile_in]])
    y_new, _ = L_layer_forward(X_new, parameters)
    st.success(f"Predicted LPA: {y_new[0][0]:.2f}")
else:
    st.info("Adjust the data/hyperparameters above and click **Train network** to begin.")

st.divider()
st.caption(
    "Built to demonstrate manual implementation of forward propagation and backpropagation "
    "(chain rule, gradient descent) without using PyTorch/TensorFlow."
)