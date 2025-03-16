function Signup() {
    return ( <div className="bg-gray-400 h-full">
        <div
        className="p-15 rounded-2xl login-container text-center bg-blue-100" 
        style={{position: 'absolute', left: '50%', top: '50%',
        transform: 'translate(-50%, -50%)',
        
        minWidth: '600px',
        maxWidth: '600px'
        }}>


    <h2 className="font-semibold text-3xl" 
        style={{marginBottom: '10px', textAlign: 'left', textTransform: 'uppercase'}}>
        Sign Up
    </h2>
    <div style={{textAlign: 'left', textTransform: 'uppercase'}}>
        The second slavic baptist church welcomes you!
        Please, create your credentials below.
    </div>

    <div style={{textAlign: 'left', textTransform: 'uppercase'}}><b>Email Address</b></div>

        <form>
            <div>
                <input 
                    className="font-light bg-gray-100 rounded-2xl pl-2"
                    style={{marginBottom: '5px', boxSizing: 'border-box', width: "100%", textTransform: 'uppercase', textAlign: 'center'}}
                    type="email"
                    placeholder="Enter email address"
                    // value={email}
                    // onChange={(e) => setEmail(e.target.value)}
                />
            </div>
        </form>


    <div style={{textAlign: 'left', textTransform: 'uppercase'}}><b>Password</b></div>

        <form>
            <div>
                <input 
                    className="font-light bg-gray-100 rounded-2xl pl-2"
                    style={{marginBottom: '5px', boxSizing: 'border-box', width: "100%", textTransform: 'uppercase', textAlign: 'center'}}
                    type="password"
                    placeholder="Enter password"
                    // value={password}
                    // onChange={(e) => setPassword(e.target.value)}
                />
            </div>
        </form>

    <div style={{textAlign: 'left', textTransform: 'uppercase'}}><b>Confirm Password</b></div>

        <form>
            <div>
                <input 
                    className="font-light bg-gray-100 rounded-2xl pl-2"
                    style={{marginBottom: '5px', boxSizing: 'border-box', width: "100%", textTransform: 'uppercase', textAlign: 'center'}}
                    type="password"
                    placeholder="Confirm password"
                    // value={password}
                    // onChange={(e) => setPassword(e.target.value)}
                />
            </div>
        </form>

    <div>
        <button style={{marginBottom: '5px', backgroundColor: "lightblue", textTransform: 'uppercase'}}>
            SIGN UP
        </button>
    </div>


    <div>
        <button style={{marginBottom: '5px', backgroundColor: "lightsteelblue", textTransform: 'uppercase'}}>
            SIGN UP WITH GOOGLE
        </button>
    </div>



    <div style={{marginTop: '10px', textTransform: 'uppercase', width: "100%"}}>
        Already have an account?<a href="./login"> Go back to login.</a>
    </div>
    </div>
    </div> );
}

export default Signup;