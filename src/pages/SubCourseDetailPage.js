import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ref, get, set } from "firebase/database";
import { db } from "../firebase";
import { getAuth } from "firebase/auth";
import "./SubCourseDetailPage.css";

const SubCourseDetailPage = () => {
  const { subCourseId } = useParams();
  const navigate = useNavigate();
  const [subCourse, setSubCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [videoEnded, setVideoEnded] = useState(false);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [userAnswers, setUserAnswers] = useState([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [submissionResult, setSubmissionResult] = useState(null);

  const auth = getAuth();
  const user = auth.currentUser;
  const videoRef = useRef(null);

  useEffect(() => {
    setStartTime(new Date()); // Set start time when component mounts

    const fetchSubCourseDetails = async () => {
      try {
        const mainCourseId = new URLSearchParams(window.location.search).get("mainCourseId");
        if (!mainCourseId) {
          throw new Error("Main course ID is not provided.");
        }

        const subCourseRef = ref(db, `courses/mainCourses/${mainCourseId}/subCourses/${subCourseId}`);
        const snapshot = await get(subCourseRef);

        if (!snapshot.exists()) {
          throw new Error(`Sub-course not found for subCourseId: ${subCourseId} in mainCourseId: ${mainCourseId}`);
        }

        const data = snapshot.val();
        setSubCourse(data);

        // Set total number of questions
        const questions = data.questions ? Object.values(data.questions) : [];
        setTotalQuestions(questions.length);
      } catch (error) {
        setError(`Error fetching sub-course details: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchSubCourseDetails();
  }, [subCourseId]);

  const handleVideoEnd = () => {
    setCurrentVideoIndex((prevIndex) => {
      const nextIndex = prevIndex + 1;
      if (nextIndex >= (subCourse.videos ? Object.values(subCourse.videos).length : 0)) {
        setVideoEnded(true);
        setEndTime(new Date()); // Set end time when all videos have ended
      }
      return nextIndex;
    });
  };

  const handleNextVideo = () => {
    if (currentVideoIndex < (subCourse.videos ? Object.values(subCourse.videos).length - 1 : 0)) {
      setCurrentVideoIndex(currentVideoIndex + 1);
    }
  };

  const handlePrevVideo = () => {
    if (currentVideoIndex > 0) {
      setCurrentVideoIndex(currentVideoIndex - 1);
    }
  };

  const handleAnswerChange = (questionIndex, answer) => {
    setUserAnswers((prevAnswers) => {
      const updatedAnswers = [...prevAnswers];
      updatedAnswers[questionIndex] = answer;
      return updatedAnswers;
    });
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSubmit = async () => {
    if (!videoEnded) {
      alert("Please watch all videos until the end before submitting.");
      return;
    }

    const totalTime = endTime ? (endTime - startTime) / 1000 : 0; // Time in seconds

    // Initialize correct answers count
    let correctCount = 0;

    if (subCourse.questions) {
      Object.values(subCourse.questions).forEach((question, index) => {
        const userAnswer = userAnswers[index];
        const correctAnswers = question.answers.filter(answer => answer.correct).map(answer => answer.text);
        if (correctAnswers.includes(userAnswer)) {
          correctCount += 1;
        }
      });
    }

    // Calculate success percentage
    let percentageSuccess = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

    const submissionData = {
      userId: user ? user.uid : "Anonymous",
      courseId: subCourseId,
      startTime: startTime.toISOString(),
      endTime: endTime ? endTime.toISOString() : "Not Completed",
      totalTime,
      percentageSuccess,
      userAnswers,
    };

    try {
      await set(ref(db, `submissions/${user.uid}/${subCourseId}`), submissionData);
      setSubmissionResult(submissionData); // Store submission result for display
      alert("Submitted!");
      navigate("/welcome");
    } catch (error) {
      console.error("Error submitting data:", error);
      alert("Failed to submit data.");
    }
  };

  const handleSeeking = (event) => {
    if (videoRef.current) {
      videoRef.current.currentTime = videoRef.current.duration; // Prevent seeking forward
    }
  };

  useEffect(() => {
    const currentVideo = videoRef.current;
    if (currentVideo) {
      currentVideo.addEventListener('seeking', handleSeeking);
      return () => {
        currentVideo.removeEventListener('seeking', handleSeeking);
      };
    }
  }, [subCourse, currentVideoIndex]);

  return (
    <div className="sub-course-detail-container">
      {loading ? (
        <p>Loading...</p>
      ) : error ? (
        <p>Error: {error}</p>
      ) : subCourse ? (
        <div>
          <h1>{subCourse.name}</h1>

          {/* عرض الفيديوهات */}
          {subCourse.videos && Object.values(subCourse.videos).length > 0 && (
            <div className="video-container">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                src={Object.values(subCourse.videos)[currentVideoIndex]}
                type="video/mp4"
                onEnded={handleVideoEnd}
                controls
              >
                Your browser does not support the video tag.
              </video>
              <div className="video-navigation">
                <button onClick={handlePrevVideo} disabled={currentVideoIndex === 0}>
                  Previous Video
                </button>
                <button onClick={handleNextVideo} disabled={currentVideoIndex >= Object.values(subCourse.videos).length - 1}>
                  Next Video
                </button>
              </div>
            </div>
          )}

          {/* عرض الأسئلة */}
          {subCourse.questions && totalQuestions > 0 && (
            <div className="question-container">
              <div className="question-navigation">
                <button onClick={handlePrevQuestion} disabled={currentQuestionIndex === 0}>
                  Previous Question
                </button>
                <span>Question {currentQuestionIndex + 1} of {totalQuestions}</span>
                <button onClick={handleNextQuestion} disabled={currentQuestionIndex >= totalQuestions - 1}>
                  Next Question
                </button>
              </div>
              <div className={`question ${userAnswers[currentQuestionIndex] === undefined ? 'unanswered' : ''}`}>
                <p>{Object.values(subCourse.questions)[currentQuestionIndex].text}</p>
                {Object.values(subCourse.questions)[currentQuestionIndex].answers.map((answer, idx) => (
                  <div key={idx} className="answer-option">
                    <input
                      type="radio"
                      name={`question-${currentQuestionIndex}`}
                      value={answer.text}
                      onChange={() => handleAnswerChange(currentQuestionIndex, answer.text)}
                      checked={userAnswers[currentQuestionIndex] === answer.text}
                    />
                    <label>{answer.text}</label>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={handleSubmit} disabled={!videoEnded}>
            Submit
          </button>

          {/* عرض نتيجة التقديم */}
          {submissionResult && (
            <div className="submission-result">
              <h2>Submission Result</h2>
              <p><strong>Percentage Success:</strong> {submissionResult.percentageSuccess ? submissionResult.percentageSuccess.toFixed(2) : 0}%</p>
              <p><strong>Total Time Spent:</strong> {submissionResult.totalTime ? `${submissionResult.totalTime.toFixed(2)} seconds` : "N/A"}</p>
            </div>
          )}
        </div>
      ) : (
        <p>Sub-course not found.</p>
      )}
    </div>
  );
};

export default SubCourseDetailPage;
